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
        bool claimed;
    }
   

    // ───────── State ─────────
    address public admin;
    uint256 public totalProjectsCreated;
    uint256 public totalSuccessfulProjects;
    uint256 public totalFailedProjects;

    mapping(address => bool) private creators;
    mapping(uint256 => Project) private projects;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    uint256 private _locked = 1; // reentrancy guard: 1 = open, 2 = locked

    // ───────── Events ─────────
    event ProjectCreated(uint256 indexed id, address indexed creator, uint256 goal, uint64 deadline);
    event Funded(uint256 indexed id, address indexed funder, uint256 accepted, uint256 refunded);
    event Withdrawn(uint256 indexed id, address indexed funder, uint256 amount);
    event ProjectSucceeded(uint256 indexed id);
    event ProjectFailed(uint256 indexed id);
    event CreatorAdded(address indexed creator);
    event CreatorRemoved(address indexed creator);
    event FundsClaimed(uint256 indexed id, address indexed creator, uint256 amount);
    event Refunded(uint256 indexed id, address indexed funder, uint256 amount);

    // ───────── Errors ─────────
    error NotAdmin();
    error NotCreator();
    error InvalidProject();
    error InvalidInput();
    error NotActive();
    error DeadlinePassed();
    error NothingToWithdraw();
    error InsufficientBalance();
    error TransferFailed();
    error Reentrancy();
    error NotProjectCreator();
    error NotFinalizable();
    error NotFailed();
    error NotFunded();
    error AlreadyClaimed();

    // ───────── Modifiers ─────────
    modifier nonReentrant() {
        if (_locked == 2) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier validProject(uint256 id) {
        if (id >= totalProjectsCreated) revert InvalidProject();
        _;
    }
    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyCreator() {
        if (!creators[msg.sender]) revert NotCreator();
        _;
    }

    // ───────── Constructor ─────────
    constructor() {
        admin = msg.sender; // deployer becomes admin (same pattern as Greeter.sol)
    }

    // ───────── Create ─────────
    /// @notice Launch a campaign. Goal is in wei, deadline is a unix timestamp.
    function createProject(
        string calldata title,
        string calldata description,
        uint256 goal,
        uint64 deadline
    ) external onlyCreator returns (uint256 id) {
        if (bytes(title).length == 0 || goal == 0 || deadline <= block.timestamp) {
            revert InvalidInput();
        }

        id = totalProjectsCreated;
        projects[id] = Project({
            creator: msg.sender,
            title: title,
            description: description,
            goal: goal,
            raised: 0,
            deadline: deadline,
            status: Status.Active,
            claimed: false
        });
        totalProjectsCreated = id + 1; // only reached if every check above passed

        emit ProjectCreated(id, msg.sender, goal, deadline);
    }

    // ───────── Fund ─────────
    /// @notice Contribute ETH. Never lets `raised` exceed `goal`; excess is refunded.
    function fundProject(uint256 id) external payable validProject(id) nonReentrant {
        Project storage p = projects[id];

        if (p.status != Status.Active) revert NotActive();      // covers already-funded projects
        if (block.timestamp >= p.deadline) revert DeadlinePassed();
        if (msg.value == 0) revert InvalidInput();

        // ── Effects ──
        uint256 remaining = p.goal - p.raised;
        uint256 accepted = msg.value > remaining ? remaining : msg.value;
        uint256 refund = msg.value - accepted;

        p.raised += accepted;
        contributions[id][msg.sender] += accepted;

        if (p.raised == p.goal) {
            p.status = Status.Funded;
            totalSuccessfulProjects++;
            emit ProjectSucceeded(id);
        }

        emit Funded(id, msg.sender, accepted, refund);

        // ── Interaction (last) ──
        if (refund > 0) _send(msg.sender, refund);
    }

    // ───────── Withdraw (before deadline) ─────────
    /// @notice A contributor takes back their full contribution while the campaign is active.
    function withdrawContribution(uint256 id) external validProject(id) nonReentrant {
        Project storage p = projects[id];

        if (p.status != Status.Active) revert NotActive();
        if (block.timestamp >= p.deadline) revert DeadlinePassed();

        uint256 amount = contributions[id][msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        if (address(this).balance < amount) revert InsufficientBalance();

        // ── Effects ──
        contributions[id][msg.sender] = 0;
        p.raised -= amount;

        emit Withdrawn(id, msg.sender, amount);

        // ── Interaction ──
        _send(msg.sender, amount);
    }
    // ───────── Admin ─────────
    function addCreator(address creator) external onlyAdmin returns (bool) {
        if (creator == address(0)) revert InvalidInput();
        creators[creator] = true;
        emit CreatorAdded(creator);
    }

    function removeCreator(address creator) external onlyAdmin {
        creators[creator] = false;
        emit CreatorRemoved(creator);
    }
    // ───────── Outcome tracking ─────────
/// @notice Anyone can call this after the deadline. It marks the project Failed
///         only if it is still Active AND below its goal, so each project is counted once.
    function finalizeProject(uint256 id) external validProject(id) {
        Project storage p = projects[id];

        if (p.status != Status.Active) revert NotActive();            // already Funded or Failed
        if (block.timestamp < p.deadline) revert NotFinalizable();    // deadline not reached yet
        if (p.raised >= p.goal) revert NotFinalizable();              // defensive: funded projects never stay Active

        p.status = Status.Failed;
        totalFailedProjects++;
        emit ProjectFailed(id);
    }
    // ───────── Settlement ─────────
/// @notice Creator collects the ETH of a successfully funded project (once).
    function claimFunds(uint256 id) external nonReentrant validProject(id) {
        Project storage p = projects[id];

        if (msg.sender != p.creator) revert NotProjectCreator();
        if (p.status != Status.Funded) revert NotFunded();
        if (p.claimed) revert AlreadyClaimed();

        p.claimed = true;
        emit FundsClaimed(id, msg.sender, p.raised);
        _send(msg.sender, p.raised);
    }

    /// @notice Contributors recover their money from a Failed project.
    function claimRefund(uint256 id) external nonReentrant validProject(id) {
        Project storage p = projects[id];

        if (p.status != Status.Failed) revert NotFailed();

        uint256 amount = contributions[id][msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        contributions[id][msg.sender] = 0;
        emit Refunded(id, msg.sender, amount);
        _send(msg.sender, amount);
    }

        

    // ───────── Views ─────────
    /// @notice Funding progress in basis points: 10000 = 100.00%, 2550 = 25.50%.
    function getFundingPercentage(uint256 id) external view validProject(id) returns (uint256) {
        Project storage p = projects[id];
        if (p.goal == 0) return 0; // defensive; createProject already forbids goal == 0
        return (p.raised * 10_000) / p.goal;
    }

    function getProject(uint256 id) external view validProject(id) returns (Project memory) {
        return projects[id];
    }
    function isCreator(address creator) external view returns (bool) {
        return creators[creator];
    }

    function getSuccessfulProjectsCount() external view returns (uint256) {
        return totalSuccessfulProjects;
    }

    function getFailedProjectsCount() external view returns (uint256) {
        return totalFailedProjects;
    }

    // ───────── Internal ─────────
    function _send(address to, uint256 amount) private {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}