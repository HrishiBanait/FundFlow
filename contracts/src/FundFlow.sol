// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FundFlow - small-scale decentralized crowdfunding
contract FundFlow {
    // ───────── Types ─────────
    enum Status { Active, Funded, Failed }

    struct Project {
        address creator;
        string title;
        string description;
        uint256 goal;
        uint256 raised;
        uint64 deadline;
        Status status;
    }

    // ───────── State ─────────
    address public admin;
    uint256 public totalProjectsCreated;
    uint256 public totalSuccessfulProjects;
    uint256 public totalFailedProjects;

    mapping(address => bool) private creators;
    mapping(uint256 => Project) private projects;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    // ───────── Events ─────────
    event ProjectCreated(uint256 indexed id, address indexed creator, uint256 goal, uint64 deadline);
    event Funded(uint256 indexed id, address indexed funder, uint256 accepted, uint256 refunded);
    event Withdrawn(uint256 indexed id, address indexed funder, uint256 amount);
    event ProjectSucceeded(uint256 indexed id);
    event ProjectFailed(uint256 indexed id);
    event CreatorAdded(address indexed creator);
    event CreatorRemoved(address indexed creator);

    // ───────── Errors ─────────
    error NotAdmin();
    error NotCreator();
    error InvalidProject();
    error InvalidInput();
    error NotActive();
    error DeadlinePassed();
    error NothingToWithdraw();
    error TransferFailed();

    // ───────── Constructor ─────────
    constructor() {
        admin = msg.sender; // deployer becomes admin (same pattern as Greeter.sol)
    }
}