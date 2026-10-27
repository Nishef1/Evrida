# Personal Finance & Money Goals

**Status:** Finance 1 and the core of Finance 2/3 are implemented as of 2026-10-27 (schema v10, backup v4). The app also supports an optional dated USD comparison rate; historical CPI import, finance reminders, broad what-if scenarios and multi-currency aggregation are not implemented.  
**Product:** Evrida  
**Principle:** Every day with Evrida.

## Product intent

Provide a lightweight, trustworthy personal-finance workspace that helps a user understand cash flow, spending patterns, purchasing power and progress toward meaningful goals. This is not a full accounting, tax, banking or investment-advice product.

Finance is optional. A user can use Evrida for planning without entering financial data. Finance setup must be progressive: ask only for what is needed for the action the user chose, let optional details be skipped, and explain what additional information would improve a forecast.

The finance area shares goal identity, time horizons, reminders and review flows with the rest of Evrida, but uses finance-specific records and calculations. Do not force every financial concept into a generic task or note.

## Core user outcomes

- Record current balances, income, expenses, refunds and transfers with minimal friction.
- Understand where money goes by month, category and custom tags.
- Distinguish recurring/fixed costs from flexible spending and irregular but predictable expenses.
- Compare actual spending with optional budgets and identify unusual changes.
- Set savings goals such as a home purchase, emergency fund, planned purchase or car-repair reserve.
- Estimate when a goal could be reached using current savings, income, spending and contribution assumptions.
- Show both nominal amounts and inflation-adjusted purchasing power, with explicit dates, assumptions and confidence.
- Explore what-if scenarios such as higher inflation, higher rent, salary increases, an unexpected repair or a different monthly contribution.
- Review progress without requiring bank connectivity or AI.

## Transaction model and categorization principles

### Transaction types

Use explicit, mutually exclusive transaction types:

- **Income:** salary, freelance income, refunds received only when not linked to reversing an expense, interest or other inflows.
- **Expense:** money paid for goods, services, bills or fees.
- **Transfer:** money moved between accounts owned by the user. Transfers change account balances but are not income or spending.
- **Adjustment:** an explicitly explained balance correction or opening balance, not a disguised expense.

Refunds should link to the original expense where possible and reduce the relevant category's net spending. A credit-card payment or movement between a user's own accounts must not be counted again as an expense if the underlying purchase was already recorded. Support splitting one transaction across categories when appropriate.

### Category vs tag

Keep the distinction clear:

- **Category answers “what was this money for?”** Every income or expense has one primary category; transfers are categorized as transfers. A split transaction may have multiple categorized lines.
- **Tags answer “what context, purpose or project does this relate to?”** A transaction can have multiple tags. Tags can connect spending to a goal, trip, work, health, a one-off event or another user-defined context.
- Categories have a small, understandable hierarchy: transaction type → group → category. Tags are cross-cutting and must not become a second, competing category tree.
- Provide sensible editable defaults, but allow custom categories, groups and tags. Never require a user to create tags before recording a transaction.
- Example: category = Food → Groceries; tags = “work week”, “travel” or “language course”. Category = Transportation → Car repair; tag = “unexpected”.
- A user may tag a transaction with a money goal, but only explicitly allocated amounts count as goal contributions. Merely tagging a purchase must not inflate goal progress.

Suggested starter categories include Housing (rent, utilities, maintenance), Food (groceries, restaurants), Transportation (fuel, public transport, repairs), Health, Education, Shopping, Subscriptions, Leisure, Family, Fees/Taxes, Savings/Goal Contributions, Salary, Other Income and Other Expense. These are defaults, not mandatory labels.

### Accounts, currency and balances

- Support manually maintained cash/bank/wallet accounts and optional liabilities in the data model; bank connection is not required.
- Show account balances and total net worth only when the user has entered enough assets and liabilities to make that summary meaningful.
- A transfer must be represented as one linked movement with an outgoing and incoming side, or an equivalent atomic record, to prevent double counting.
- Configure the user's reporting currency and display precision explicitly. For currencies with common major/minor-unit ambiguity (for example, Rial vs Toman), require an explicit unit label and never silently multiply or divide by ten. An optional dated USD comparison rate may display an approximate dollar equivalent without changing stored balances; it is not multi-currency accounting.
- The first usable release may operate in one reporting currency. Do not add or sum a second currency without an explicit, dated exchange rate. Multi-currency reporting and bank imports are later scope unless needed by the user.
- Record transaction date, amount, currency/unit, type, category, tags, account, optional payee/description, optional note, and optional link to a goal or recurring rule.
- Local-first storage, export/restore and schema migration are mandatory before real financial use. No financial records may be sent to a server or AI service in the initial implementation.

## Cash flow, budgets and spending insights

- Track actual income, actual expenses, net cash flow and savings rate by month. Transfers are excluded from income/expense totals.
- Show monthly spending by category and tag, trends over 3/6/12 months when enough history exists, and comparisons with prior periods.
- Separate predictable fixed expenses, flexible spending and irregular but expected expenses. For annual fees, vehicle maintenance or other non-monthly costs, let the user set a target and frequency and optionally reserve a monthly amount (“sinking fund”).
- Budgets are optional. A user may set an overall monthly spending target or category-level targets, carry forward a balance where appropriate, and receive opt-in threshold warnings.
- Recurring salary, rent, bills and subscriptions may be entered manually as rules with dates and reminders. Future recurring items are forecasts until confirmed; they must not be silently recorded as completed transactions.
- Highlight observations rather than blame: for example, “Food spending is 18% above your 3-month average” and show the comparison window and data coverage. Do not claim a trend from a single month.
- Support a quick-add flow and sensible defaults. Optional rules may suggest a category/tag based on a user's own history, but the user can review and correct them. AI-based categorization is not a prerequisite.

## Money goals and forecast

A money goal may represent a home purchase, car purchase, emergency fund, education, a large planned purchase or another financial milestone. Link it to an existing long-range goal where appropriate.

Inputs may include:
- current amount allocated to this goal (not the user's entire balance unless explicitly allocated);
- current target price/amount and target date, if known;
- planned monthly contribution or a contribution rule;
- optional expected income and expense changes;
- optional one-off future costs;
- optional target-specific price growth assumption;
- optional general inflation assumption or an imported, dated price index;
- optional scenario for salary growth, savings return or other variables.

Required outputs:
- remaining nominal amount at today's prices;
- estimated monthly contribution needed for a chosen date;
- estimated date/window at the current contribution rate;
- projected nominal target amount at the future date;
- purchasing-power-equivalent amount expressed in the selected base period;
- best/base/slower scenarios when the inputs support them;
- a plain-language explanation of assumptions, missing data and the main drivers of change.

Do not assume all cash is available for every goal. If several goals exist, show their assigned balances and planned contributions separately. Do not silently redistribute money between goals. Let users set priority or change allocations explicitly.

### Forecast math and inflation semantics

- **Nominal value** is the amount recorded in the currency of the transaction or forecast date.
- **Real value** is a nominal amount adjusted to a stated base date using a price index. With price-index values available, calculate: real value at base = nominal value × (base index / current index).
- For a user-entered annual inflation assumption r over t years, the illustrative price-level factor is (1 + r)^t; show that this is a scenario, not observed inflation.
- **General inflation and target-specific price growth are different inputs.** General inflation expresses purchasing power. A home-price growth assumption estimates how the price of that specific target may change. Do not apply both to the same target price as if they were the same adjustment.
- When calculating a future target, apply the target-specific growth assumption to today's target price. When presenting that future amount in today's purchasing power, deflate it using the general price-level assumption/index. Label both values and dates.
- Estimate savings from allocated starting funds and planned contributions. In the first version, assume no investment return unless the user explicitly enters a scenario. Never imply that cash savings automatically earn a return.
- Use dated historical price-index values for retrospective real-value comparisons when a trustworthy source exists. For forward-looking forecasts, allow manual scenario rates and label their source/date. Never fabricate current inflation data or silently substitute another country's index. A dollar exchange rate is not an inflation index and must not be used as a proxy for purchasing-power change.
- Show ranges rather than false precision when income, expenses, target growth or inflation are uncertain. If there is insufficient history, label the estimate provisional and state which user input would improve it.
- Do not claim an exact goal date if the projected contribution is zero/negative, data is missing, or the target is not feasible. Explain the gap and show options such as changing the date, contribution, target or spending assumptions.

## Scenario analysis and recommendations

Let users compare a small number of understandable scenarios, for example:
- current contribution and current assumptions;
- higher/lower inflation;
- salary increase or decrease;
- one-off expense such as a car repair;
- a chosen additional monthly contribution;
- a changed target date.

Recommendations should be transparent arithmetic and trade-offs, not opaque commands. Prefer “At this contribution, the goal is likely to take longer; adding X per month would move the estimated window to Y” over vague financial coaching. Never initiate a transfer, payment, investment or other financial action.

## Reminders and review

- Optional reminders for recurring bills, salary dates, budget thresholds, planned contributions and goal checkpoints.
- Monthly finance review: income, spending, savings rate, largest categories, irregular costs, upcoming bills, goal progress and changes in forecast.
- Reminders must be opt-in and permission-aware. Notification denial must not break finance tracking.
- Distinguish planned transactions from actual confirmed transactions.

## Privacy, reliability and safety

- Finance remains optional and offline-first; no sign-in, cloud sync, bank connection or external AI in the first version.
- Include transactions, categories, tags, accounts, recurring rules, budgets, goal allocations and assumptions in validated backup/restore.
- Make editing, correction, deletion and export discoverable. Preserve audit-relevant history where appropriate; never silently rewrite past actual transactions when assumptions change.
- Handle duplicate imports, split transactions, refunds, transfers, missing months, irregular income, negative balances, rounding, currency-unit ambiguity and time-zone/date boundaries explicitly.
- Do not make financial decisions for the user or present projections as guaranteed outcomes. Evrida is a planning tool, not a substitute for a professional accountant, tax professional, fiduciary or investment adviser.
- No data-driven spending “insight” should be presented without showing the relevant period, data coverage and calculation.

## Delivery plan

### Finance 1 — Trustworthy manual ledger

- [x] Optional finance entry point and progressive setup; allow users to skip the module.
- [x] Configure base currency/unit and opening balances.
- [x] Quick-add income, expense, transfer and adjustment records.
- [x] Editable category hierarchy, multiple tags, transaction notes and optional goal link.
- [x] Monthly income/expense/net-cash-flow totals and category/tag breakdown.
- [x] Correct handling of transfers, refunds, split transactions and card payments.
- [x] Export/restore, migrations and essential tests before real use.

### Finance 2 — Budgets, recurring costs and money goals

- [x] Optional monthly/category budgets and recurring planned items. _Reminders are not built yet._
- [x] Fixed/flexible/irregular expense views and sinking funds.
- [x] Goal allocations, target dates and monthly contribution plans.
- [x] Goal ETA and required-contribution calculations with transparent assumptions.
- [x] Six-month trend only when three months have records. _A dedicated monthly review screen is not built._

### Finance 3 — Inflation-aware forecasts

- [x] Nominal vs real values using a user-entered inflation scenario. _A dated price-index import is not built._
- [x] User-configurable general-inflation and target-specific price-growth scenarios.
- [x] Best/base/slower forecast windows, sensitivity to one-off costs and income changes.
- [x] Data-quality/confidence indicators and explanations of what is missing.
- [ ] Optional multi-currency reporting only after explicit exchange-rate provenance and rounding rules are designed.

### Deferred until validated need

- Bank-account integrations and automatic transaction imports.
- Investment portfolio, tax filing, accounting statements and financial advice.
- AI categorization, receipt OCR or automatic web price/inflation scraping.
- Cloud synchronization, household collaboration and hosted financial data.

## Acceptance criteria

- [ ] Finance is optional and the core planning app works without any financial setup.
- [ ] A user can record a salary, groceries, rent, car repair and a transfer without transfers inflating income or spending.
- [ ] Categories answer “what”; tags can span multiple categories and answer “context/goal”.
- [ ] A refund and a split transaction produce correct category totals.
- [ ] Monthly cash flow and category trends reconcile to the recorded ledger; missing months are not treated as zero spending.
- [ ] An irregular annual expense can be planned without being recorded as an actual monthly expense.
- [ ] A savings goal uses only funds explicitly allocated to it and does not double-count the same balance across goals.
- [ ] A target forecast distinguishes current target price, future nominal target and inflation-adjusted real value.
- [ ] General inflation and target-specific price growth are separate, labeled assumptions; changing one does not silently change the other.
- [ ] A forecast with insufficient data is labeled provisional and lists its assumptions; an infeasible target does not receive a fabricated completion date.
- [ ] Currency/unit ambiguity is explicit; different currencies cannot be summed without a dated conversion rate.
- [ ] Backup/restore round-trips all finance data, tags, categories, assumptions and goal allocations.
- [ ] Reminders are opt-in, and denial of notification permission leaves manual tracking functional.
- [ ] The existing 20-test budget is respected by extending/replacing meaningful tests rather than adding redundant cases.

## Research basis

This design borrows established patterns—not proprietary implementation—from personal-finance products that separate transaction type, category and cross-cutting tags, support custom categories, budget by month, recurring bills, goal-linked balances and spending reports. For inflation-adjusted values, use the documented price-index approach rather than applying an unlabeled flat multiplier to every financial figure. Product-specific research links are maintained outside this public implementation spec; only public, non-sensitive design decisions belong here.

## Dollar view (added 2026-10-27)

An optional, dated USD rate (units of the reporting currency per 1 US dollar) lets amount fields and account balances show a dollar value. It never changes a stored amount and is not a second currency in the ledger. The rate can be typed or fetched on request from a public source: for Toman/Rial the market price of USDT on Bitpin (fallback Wallex), otherwise a daily reference rate from open.er-api.com. Only a request for the rate leaves the device. The source and date are stored with the rate and shown wherever it is used. Native-currency amounts always remain the source of truth.
