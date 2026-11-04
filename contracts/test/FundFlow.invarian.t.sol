// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FundFlow} from "../src/FundFlow.sol";

/// @dev Makes random, valid-ish calls to FundFlow. The handler is admin AND creator of 3 projects.
contract Handler is Test {
    FundFlow public ff;
    uint256 public constant NUM = 3;
    address[] public actors;

    constructor() {
        ff = new FundFlow();
        ff.addCreator(address(this));
        for (uint256 i; i < NUM; i++) {
            actors.push(makeAddr(string.concat("actor", vm.toString(i))));
            vm.deal(actors[i], 1_000 ether);
            ff.createProject("P", "d", (i + 1) * 5 ether, uint64(block.timestamp + (i + 1) * 3 days));
        }
    }

    function fund(uint256 actorSeed, uint256 projectSeed, uint256 amount) external {
        amount = bound(amount, 1, 20 ether);
        vm.prank(actors[actorSeed % NUM]);
        try ff.fundProject{value: amount}(projectSeed % NUM) {} catch {}
    }

    function withdraw(uint256 actorSeed, uint256 projectSeed) external {
        vm.prank(actors[actorSeed % NUM]);
        try ff.withdrawContribution(projectSeed % NUM) {} catch {}
    }

    function finalize(uint256 projectSeed) external {
        try ff.finalizeProject(projectSeed % NUM) {} catch {}
    }

    function claimRefund(uint256 actorSeed, uint256 projectSeed) external {
        vm.prank(actors[actorSeed % NUM]);
        try ff.claimRefund(projectSeed % NUM) {} catch {}
    }

    function claimFunds(uint256 projectSeed) external {
        try ff.claimFunds(projectSeed % NUM) {} catch {}
    }

    function warp(uint256 delta) external {
        vm.warp(block.timestamp + bound(delta, 1 hours, 3 days));
    }

    receive() external payable {} // creator must be able to receive claimed funds
}

contract FundFlowInvariantTest is Test {
    Handler h;
    FundFlow ff;

    function setUp() public {
        h = new Handler();
        ff = h.ff();
        targetContract(address(h));

        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = Handler.fund.selector;
        selectors[1] = Handler.withdraw.selector;
        selectors[2] = Handler.finalize.selector;
        selectors[3] = Handler.claimRefund.selector;
        selectors[4] = Handler.claimFunds.selector;
        selectors[5] = Handler.warp.selector;
        targetSelector(FuzzSelector({addr: address(h), selectors: selectors}));
    }

    /// A project never holds more than its goal.
    function invariant_RaisedNeverExceedsGoal() public view {
        for (uint256 i; i < h.NUM(); i++) {
            FundFlow.Project memory p = ff.getProject(i);
            assertLe(p.raised, p.goal);
        }
    }

    /// A Funded project has raised exactly its goal.
    function invariant_FundedMeansExactlyGoal() public view {
        for (uint256 i; i < h.NUM(); i++) {
            FundFlow.Project memory p = ff.getProject(i);
            if (p.status == FundFlow.Status.Funded) assertEq(p.raised, p.goal);
        }
    }

    /// Each project is counted once: counters always equal the number of projects in that status.
    function invariant_CountersMatchStatuses() public view {
        uint256 funded;
        uint256 failed;
        for (uint256 i; i < h.NUM(); i++) {
            FundFlow.Status s = ff.getProject(i).status;
            if (s == FundFlow.Status.Funded) funded++;
            if (s == FundFlow.Status.Failed) failed++;
        }
        assertEq(ff.getSuccessfulProjectsCount(), funded);
        assertEq(ff.getFailedProjectsCount(), failed);
    }

    /// The contract's ETH balance equals exactly what it still owes to people.
    function invariant_BalanceEqualsObligations() public view {
        uint256 n = h.NUM();
        uint256 owed;
        for (uint256 i; i < n; i++) {
            FundFlow.Project memory p = ff.getProject(i);
            if (p.status == FundFlow.Status.Active || (p.status == FundFlow.Status.Funded && !p.claimed)) {
                owed += p.raised;
            } else if (p.status == FundFlow.Status.Failed) {
                for (uint256 j; j < n; j++) owed += ff.contributions(i, h.actors(j));
            }
        }
        assertEq(address(ff).balance, owed);
    }
}