// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {FundFlow} from "../src/FundFlow.sol";
/// @dev A malicious contributor that tries to re-enter FundFlow when it receives ETH.
contract Attacker {
    FundFlow public ff;
    uint256 public id;
    uint8 public mode; // 0 = re-enter withdraw, 1 = re-enter fund
    bool public reenterAttempted;
    bool public reenterSucceeded;

    constructor(FundFlow _ff) {
        ff = _ff;
    }

    function fundAndWithdraw(uint256 _id) external payable {
        id = _id;
        mode = 0;
        ff.fundProject{value: msg.value}(_id);
        ff.withdrawContribution(_id);
    }

    function overfund(uint256 _id) external payable {
        id = _id;
        mode = 1;
        ff.fundProject{value: msg.value}(_id);
    }

    receive() external payable {
        if (reenterAttempted) return;
        reenterAttempted = true;
        if (mode == 0) {
            try ff.withdrawContribution(id) { reenterSucceeded = true; } catch {}
        } else {
            try ff.fundProject{value: 1 wei}(id) { reenterSucceeded = true; } catch {}
        }
    }
}

contract FundFlowTest is Test {
    FundFlow ff;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        ff = new FundFlow();
        ff.addCreator(address(this)); 
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        ff.createProject("Test", "Desc", 10 ether, uint64(block.timestamp + 7 days));
    }

    function test_CreateProject() public view {
        assertEq(ff.totalProjectsCreated(), 1);
        FundFlow.Project memory p = ff.getProject(0);
        assertEq(p.goal, 10 ether);
        assertEq(p.raised, 0);
    }

    function test_PercentageIsBasisPoints() public {
        vm.prank(alice);
        ff.fundProject{value: 4 ether}(0);
        assertEq(ff.getFundingPercentage(0), 4000); // 40.00%
    }

    function test_OverfundRefundsExcess() public {
        vm.prank(alice);
        ff.fundProject{value: 8 ether}(0);

        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        ff.fundProject{value: 3 ether}(0);

        assertEq(bobBefore - bob.balance, 2 ether);     // only 2 ETH kept
        assertEq(ff.contributions(0, bob), 2 ether);
        FundFlow.Project memory p = ff.getProject(0);
        assertEq(p.raised, 10 ether);
        assertEq(uint8(p.status), uint8(FundFlow.Status.Funded));
        assertEq(ff.totalSuccessfulProjects(), 1);
        assertEq(address(ff).balance, 10 ether);
    }

    function test_CannotFundAfterGoalReached() public {
        vm.prank(alice);
        ff.fundProject{value: 10 ether}(0);
        vm.prank(bob);
        vm.expectRevert(FundFlow.NotActive.selector);
        ff.fundProject{value: 1 ether}(0);
    }

    function test_WithdrawReturnsFundsAndUpdatesTotals() public {
        vm.startPrank(alice);
        ff.fundProject{value: 4 ether}(0);
        ff.withdrawContribution(0);
        vm.stopPrank();

        assertEq(alice.balance, 100 ether);
        assertEq(ff.getProject(0).raised, 0);
        assertEq(ff.contributions(0, alice), 0);
    }

    function test_DoubleWithdrawReverts() public {
        vm.startPrank(alice);
        ff.fundProject{value: 4 ether}(0);
        ff.withdrawContribution(0);
        vm.expectRevert(FundFlow.NothingToWithdraw.selector);
        ff.withdrawContribution(0);
        vm.stopPrank();
    }

    function test_WithdrawAfterDeadlineReverts() public {
        vm.prank(alice);
        ff.fundProject{value: 4 ether}(0);
        vm.warp(block.timestamp + 8 days);
        vm.prank(alice);
        vm.expectRevert(FundFlow.DeadlinePassed.selector);
        ff.withdrawContribution(0);
    }

    function test_NonContributorCannotWithdraw() public {
        vm.prank(alice);
        ff.fundProject{value: 4 ether}(0);
        vm.prank(bob);
        vm.expectRevert(FundFlow.NothingToWithdraw.selector);
        ff.withdrawContribution(0);
    }

    function test_InvalidProjectReverts() public {
        vm.expectRevert(FundFlow.InvalidProject.selector);
        ff.getFundingPercentage(99);
    }
    function test_OnlyAdminCanAddCreator() public {
    vm.prank(alice);
    vm.expectRevert(FundFlow.NotAdmin.selector);
    ff.addCreator(alice);
    }

    function test_AdminAddsAndRemovesCreator() public {
        ff.addCreator(alice);
        assertTrue(ff.isCreator(alice));
        ff.removeCreator(alice);
        assertFalse(ff.isCreator(alice));
    }

    function test_NonCreatorCannotCreateProject() public {
        vm.prank(alice);
        vm.expectRevert(FundFlow.NotCreator.selector);
        ff.createProject("X", "Y", 1 ether, uint64(block.timestamp + 1 days));
    }

    function test_FailedCreateDoesNotIncrementCount() public {
        vm.prank(alice);
        vm.expectRevert(FundFlow.NotCreator.selector);
        ff.createProject("X", "Y", 1 ether, uint64(block.timestamp + 1 days));
        assertEq(ff.totalProjectsCreated(), 1); // still just the setUp project
    }

    function test_FinalizeBeforeDeadlineReverts() public {
        vm.expectRevert(FundFlow.NotFinalizable.selector);
        ff.finalizeProject(0);
    }

    function test_FinalizeMarksFailedOnce() public {
        vm.prank(alice);
        ff.fundProject{value: 4 ether}(0);
        vm.warp(block.timestamp + 8 days);

        ff.finalizeProject(0);
        assertEq(ff.getFailedProjectsCount(), 1);
        assertEq(uint8(ff.getProject(0).status), uint8(FundFlow.Status.Failed));

        vm.expectRevert(FundFlow.NotActive.selector);   // repeated call rejected
        ff.finalizeProject(0);
        assertEq(ff.getFailedProjectsCount(), 1);       // still 1
    }

    function test_FundedProjectCannotBeFinalizedAsFailed() public {
        vm.prank(alice);
        ff.fundProject{value: 10 ether}(0);
        vm.warp(block.timestamp + 8 days);

        vm.expectRevert(FundFlow.NotActive.selector);
        ff.finalizeProject(0);
        assertEq(ff.getFailedProjectsCount(), 0);
        assertEq(ff.getSuccessfulProjectsCount(), 1);
    }

    function test_ContributorClaimsRefundAfterFailure() public {
        vm.prank(alice);
        ff.fundProject{value: 4 ether}(0);
        vm.warp(block.timestamp + 8 days);
        ff.finalizeProject(0);

        vm.prank(alice);
        ff.claimRefund(0);
        assertEq(alice.balance, 100 ether);

        vm.prank(alice);
        vm.expectRevert(FundFlow.NothingToWithdraw.selector); // no double refund
        ff.claimRefund(0);
    }

    function test_CreatorClaimsFundsOnce() public {
        vm.prank(alice);
        ff.fundProject{value: 10 ether}(0);

        uint256 before = address(this).balance;
        ff.claimFunds(0);
        assertEq(address(this).balance - before, 10 ether);

        vm.expectRevert(FundFlow.AlreadyClaimed.selector);
        ff.claimFunds(0);
    }

    function test_NonCreatorCannotClaimFunds() public {
        vm.prank(alice);
        ff.fundProject{value: 10 ether}(0);
        vm.prank(bob);
        vm.expectRevert(FundFlow.NotProjectCreator.selector);
        ff.claimFunds(0);
    }
        // ───────── Extra unit tests ─────────
    function test_FundAfterDeadlineReverts() public {
        vm.warp(block.timestamp + 8 days);
        vm.prank(alice);
        vm.expectRevert(FundFlow.DeadlinePassed.selector);
        ff.fundProject{value: 1 ether}(0);
    }

    function test_ZeroValueFundReverts() public {
        vm.prank(alice);
        vm.expectRevert(FundFlow.InvalidInput.selector);
        ff.fundProject{value: 0}(0);
    }

    function test_CreateProjectInvalidInputReverts() public {
        vm.expectRevert(FundFlow.InvalidInput.selector);
        ff.createProject("", "d", 1 ether, uint64(block.timestamp + 1 days));   // empty title

        vm.expectRevert(FundFlow.InvalidInput.selector);
        ff.createProject("T", "d", 0, uint64(block.timestamp + 1 days));        // zero goal

        vm.expectRevert(FundFlow.InvalidInput.selector);
        ff.createProject("T", "d", 1 ether, uint64(block.timestamp));           // deadline not in future

        assertEq(ff.totalProjectsCreated(), 1);
    }

    function test_ClaimRefundBeforeFinalizeReverts() public {
        vm.prank(alice);
        ff.fundProject{value: 4 ether}(0);
        vm.warp(block.timestamp + 8 days);   // expired, but nobody has called finalizeProject yet
        vm.prank(alice);
        vm.expectRevert(FundFlow.NotFailed.selector);
        ff.claimRefund(0);
    }

    function test_ClaimRefundOnFundedProjectReverts() public {
        vm.prank(alice);
        ff.fundProject{value: 10 ether}(0);
        vm.prank(alice);
        vm.expectRevert(FundFlow.NotFailed.selector);
        ff.claimRefund(0);
    }

    // ───────── Reentrancy ─────────
    function test_ReentrancyOnWithdrawIsBlocked() public {
        vm.prank(bob);
        ff.fundProject{value: 5 ether}(0);          // an innocent user's money the attacker would love to steal

        Attacker atk = new Attacker(ff);
        vm.prank(alice);
        atk.fundAndWithdraw{value: 4 ether}(0);

        assertTrue(atk.reenterAttempted());
        assertFalse(atk.reenterSucceeded());
        assertEq(address(atk).balance, 4 ether);    // got back exactly what it put in
        assertEq(address(ff).balance, 5 ether);     // bob's money untouched
        assertEq(ff.getProject(0).raised, 5 ether);
    }

    function test_ReentrancyOnRefundIsBlocked() public {
        vm.prank(alice);
        ff.fundProject{value: 8 ether}(0);

        Attacker atk = new Attacker(ff);
        vm.prank(bob);
        atk.overfund{value: 3 ether}(0);            // 2 accepted, 1 refunded -> triggers receive()

        assertTrue(atk.reenterAttempted());
        assertFalse(atk.reenterSucceeded());
        assertEq(address(atk).balance, 1 ether);
        assertEq(address(ff).balance, 10 ether);
        assertEq(ff.getProject(0).raised, 10 ether);
        assertEq(ff.contributions(0, address(atk)), 2 ether);
    }

    // ───────── Fuzz tests ─────────
    function testFuzz_NeverOverfunds(uint256 a, uint256 b) public {
        a = bound(a, 1, 30 ether);
        b = bound(b, 1, 30 ether);

        vm.prank(alice);
        ff.fundProject{value: a}(0);
        if (ff.getProject(0).status == FundFlow.Status.Active) {
            vm.prank(bob);
            ff.fundProject{value: b}(0);
        }

        FundFlow.Project memory p = ff.getProject(0);
        assertLe(p.raised, p.goal);
        assertEq(address(ff).balance, p.raised);                         // contract holds exactly what was accepted
        assertEq(alice.balance + bob.balance + p.raised, 200 ether);     // no ETH created or lost
    }

    function testFuzz_PercentageMatchesFormula(uint256 amount) public {
        amount = bound(amount, 1, 10 ether);
        vm.prank(alice);
        ff.fundProject{value: amount}(0);
        assertEq(ff.getFundingPercentage(0), (amount * 10_000) / 10 ether);
    }

    function testFuzz_WithdrawRestoresState(uint256 amount) public {
        amount = bound(amount, 1, 9 ether);   // stay below goal so project remains Active
        vm.startPrank(alice);
        ff.fundProject{value: amount}(0);
        ff.withdrawContribution(0);
        vm.stopPrank();

        assertEq(alice.balance, 100 ether);
        assertEq(ff.getProject(0).raised, 0);
        assertEq(address(ff).balance, 0);
    }

    function testFuzz_WithdrawOnlyBeforeDeadline(uint256 t) public {
        vm.prank(alice);
        ff.fundProject{value: 4 ether}(0);

        uint256 deadline = ff.getProject(0).deadline;
        t = bound(t, block.timestamp, deadline + 30 days);
        vm.warp(t);

        vm.prank(alice);
        if (t < deadline) {
            ff.withdrawContribution(0);
            assertEq(ff.contributions(0, alice), 0);
        } else {
            vm.expectRevert(FundFlow.DeadlinePassed.selector);
            ff.withdrawContribution(0);
        }
    }

    // The test contract is the project creator, so it must be able to receive ETH
    receive() external payable {}
}