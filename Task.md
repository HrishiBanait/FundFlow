# FundFlow: Task Completion Map

This file shows where each assigned task is implemented, how it is tested, and where it appears in the UI.

- **Contract:** `contracts/src/FundFlow.sol`
- **Unit, fuzz and reentrancy tests:** `contracts/test/FundFlow.t.sol`
- **Invariant tests:** `contracts/test/FundFlow.invariant.t.sol`
- **Live contract (Sepolia, verified):** [`0x578A2bd5b7606FaEFD847C6C24b0E34C9bdd5B4C`](https://sepolia.etherscan.io/address/0x578A2bd5b7606FaEFD847C6C24b0E34C9bdd5B4C#code)

| # | Task | Status |
|---|------|--------|
| 1 | Funding percentage (read-only) | Done |
| 2 | Funder withdrawal before deadline | Done |
| 3 | Exact funding goal enforcement | Done |
| 4 | Admin and creator management | Done |
| 5 | Total projects created | Done |
| 6 | Successful and failed project tracking | Done |

---

## 1. Read-only function: percentage of funding raised

> a. Takes `projectId` as a parameter
> b. Returns the percentage of funding raised so far

**Contract:** `getFundingPercentage(uint256 id)` in `FundFlow.sol`
- `view` function, so it never changes state.
- Takes the project id and returns `raised * 10_000 / goal`. The result is in **basis points** (10000 = 100.00%, 2550 = 25.50%), which gives two decimal places of precision.
- An invalid id reverts with `InvalidProject` through the `validProject` modifier. A zero goal returns 0 (and `createProject` already rejects a zero goal).

**Tests:**
- `test_PercentageIsBasisPoints`
- `testFuzz_PercentageMatchesFormula`
- `test_InvalidProjectReverts`

**Frontend:**
- `frontend/src/lib/hooks.ts` (`useProjects` reads it for every project)
- `frontend/src/components/ProjectCard.tsx` and `frontend/src/app/project/[id]/page.tsx` (progress bars)

---

## 2. Users withdrawing funds before the deadline

> a. Funders can withdraw their invested funds before the deadline is over
> b. A separate method is used for this

**Contract:** `withdrawContribution(uint256 id)` in `FundFlow.sol`, a separate function from `fundProject`.
- Only the caller's own recorded contribution can be withdrawn (`contributions[id][msg.sender]`).
- Allowed only while the project is `Active` and `block.timestamp < deadline`.
- Zeroes the caller's contribution and reduces `raised` **before** sending ETH (Checks-Effects-Interactions), and is protected by `nonReentrant`.
- Reverts with `NothingToWithdraw` for non-contributors and double withdrawals, `DeadlinePassed` after the deadline, and `NotActive` for funded or failed projects.

**Tests:**
- `test_WithdrawReturnsFundsAndUpdatesTotals`
- `test_DoubleWithdrawReverts`
- `test_WithdrawAfterDeadlineReverts`
- `test_NonContributorCannotWithdraw`
- `test_ReentrancyOnWithdrawIsBlocked`
- `testFuzz_WithdrawRestoresState`
- `testFuzz_WithdrawOnlyBeforeDeadline`

**Frontend:** the "Withdraw my contribution" button in `frontend/src/components/ProjectActions.tsx`.

---

## 3. Exact funding goal (no overfunding)

> a. Return the extra funds to the last user trying to fund

**Contract:** `fundProject(uint256 id)` in `FundFlow.sol`
- Calculates `remaining = goal - raised`, then `accepted = min(msg.value, remaining)` and `refund = msg.value - accepted`.
- Only `accepted` is added to `raised` and to the funder's contribution, so `raised` can never exceed `goal`.
- The excess `refund` is sent back to `msg.sender` (the last funder) as the final step, under `nonReentrant`.
- When `raised == goal` the project becomes `Funded`. Any further funding reverts with `NotActive`.
- Example: goal 10 ETH, raised 8 ETH, a 3 ETH contribution gives 2 ETH accepted and 1 ETH refunded.

**Tests:**
- `test_OverfundRefundsExcess`
- `test_CannotFundAfterGoalReached`
- `test_ReentrancyOnRefundIsBlocked`
- `test_ZeroValueFundReverts`
- `testFuzz_NeverOverfunds`
- Invariants: `invariant_RaisedNeverExceedsGoal`, `invariant_FundedMeansExactlyGoal`, `invariant_BalanceEqualsObligations`

**Frontend:** the contribute form in `ProjectActions.tsx` shows a live preview of how much will be accepted and refunded before the user signs.

---

## 4. Admin functionality

> a. A variable stores the admin, set to the deployer in the constructor
> b. Admin can add creators
> c. Admin can remove creators
> d. `createProject` is restricted to added creators

**Contract:** in `FundFlow.sol`
- `address public admin;` is set in the constructor with `admin = msg.sender;`.
- `mapping(address => bool) private creators;` tracks approved creators.
- `addCreator(address)` and `removeCreator(address)` are both guarded by the `onlyAdmin` modifier.
- `isCreator(address)` is a read-only check.
- `createProject(...)` is guarded by the `onlyCreator` modifier.

> Note: `Greeter.sol` was not shared during development, so the constructor follows the standard `msg.sender` initialization pattern. If your training `Greeter.sol` differs, compare the two constructors before submission.

**Tests:**
- `test_OnlyAdminCanAddCreator`
- `test_AdminAddsAndRemovesCreator`
- `test_NonCreatorCannotCreateProject`

**Frontend:**
- `frontend/src/app/admin/page.tsx` (add and remove creators)
- `frontend/src/lib/hooks.ts` (`useRole`)
- `frontend/src/components/Header.tsx` (the **Admin** and **Create** links appear only for the admin and approved creators)
- `frontend/src/app/create/page.tsx` (creator-only form)

---

## 5. Variable to track total projects created

**Contract:** `uint256 public totalProjectsCreated;` in `FundFlow.sol`
- Incremented once at the end of `createProject`, after every check has passed. A reverted transaction rolls back the increment.
- The free public getter doubles as the next project id.

**Tests:**
- `test_CreateProject`
- `test_FailedCreateDoesNotIncrementCount`
- `test_CreateProjectInvalidInputReverts`

**Frontend:** the "Campaigns created" stat on the home page (`frontend/src/app/page.tsx`).

---

## 6. Track successfully funded and failed projects

> a. Variables keep track of successful and failed projects
> b. A function returns the number of successful projects
> c. A function returns the number of failed projects

**Contract:** in `FundFlow.sol`
- Variables: `totalSuccessfulProjects` and `totalFailedProjects`.
- **Success** is counted inside `fundProject` at the moment `raised == goal` (status moves `Active` to `Funded`).
- **Failure** is counted in `finalizeProject(id)`, which anyone can call after the deadline. It first checks that the project is still `Active`, the deadline has passed and `raised < goal`, then sets the status to `Failed`. It does not assume failure from the deadline alone.
- A project can leave `Active` only once, so every project is counted exactly once, and never as both.
- Getters: `getSuccessfulProjectsCount()` and `getFailedProjectsCount()`.
- Supporting functions: `claimFunds` (creator collects a funded campaign) and `claimRefund` (contributors recover money from a failed campaign).

**Tests:**
- `test_FinalizeBeforeDeadlineReverts`
- `test_FinalizeMarksFailedOnce` (a repeated call is rejected and the counter stays at 1)
- `test_FundedProjectCannotBeFinalizedAsFailed`
- `test_ContributorClaimsRefundAfterFailure`
- `test_ClaimRefundBeforeFinalizeReverts`
- `test_ClaimRefundOnFundedProjectReverts`
- `test_CreatorClaimsFundsOnce`
- `test_NonCreatorCannotClaimFunds`
- Invariant: `invariant_CountersMatchStatuses`

**Frontend:**
- The "Successfully funded" and "Failed" stats on the home page
- The **Finalize campaign** and **Claim refund** buttons in `ProjectActions.tsx`
- The Active, Funded, Expired and Failed badges (`frontend/src/lib/utils.ts`)

---

## How to verify

```bash
cd contracts
forge test          # unit, fuzz, reentrancy and invariant tests
forge coverage      # coverage report
```