// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FundFlow} from "../src/FundFlow.sol";

contract FundFlowTest is Test {
    FundFlow ff;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        ff = new FundFlow();
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
}