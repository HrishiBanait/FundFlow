// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "../lib/forge-std/src/Script.sol";
import {FundFlow} from "../src/FundFlow.sol";

contract Deploy is Script {
    function run() external returns (FundFlow ff) {
        vm.startBroadcast();   
        ff = new FundFlow();   
        vm.stopBroadcast();
        console.log("FundFlow deployed at:", address(ff));
    }
}