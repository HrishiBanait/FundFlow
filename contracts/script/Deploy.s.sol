// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "../lib/forge-std/src/Script.sol";
import {FundFlow} from "../src/FundFlow.sol";

contract Deploy is Script {
    function run() external returns (FundFlow ff) {
        vm.startBroadcast();   // everything below is sent as a real transaction
        ff = new FundFlow();   // the sender becomes admin via the constructor
        vm.stopBroadcast();
        console.log("FundFlow deployed at:", address(ff));
    }
}