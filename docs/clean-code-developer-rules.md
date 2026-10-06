# Clean Code Developer Rules

## Application Contract

This document defines general software-engineering conventions for human and automated contributors. Repository-specific architecture, language, formatter, and task instructions take precedence. Apply a numbered rule only when its anti-pattern is present, preserve observable behavior unless the task changes it, prefer the smallest verifiable diff, and do not add abstractions, wrappers, interfaces, factories, files, or dependencies unless they remove demonstrated complexity.

Every numbered rule is atomic: it contains one directive, one single-sentence rationale, and one anti-pattern/enforced-pattern snippet pair. Before editing, read repository instructions, inspect only the task-relevant code, identify the violated rule, state the behavior that must remain unchanged, and choose the smallest safe change; after editing, run the relevant existing checks and report the files changed, rules applied, verification results, and remaining risks, and report why any check could not run.

# 1. Naming

## 1.1 Name scalar values by domain meaning

**Directive:** Replace single-letter or generic scalar names with terms that state what each value represents and how callers use it.

**Rationale:** Names should explain why a value exists and what it represents without requiring a comment or a trace through the code.

### Anti-Pattern

```javascript
let d;
d = getElapsedTimeInDays();
if (d > 30) {
  sendReminderEmail(d);
}
logActivity(d);
```

### Enforced Pattern

```javascript
let elapsedTimeInDays = getElapsedTimeInDays();
if (elapsedTimeInDays > 30) {
  sendReminderEmail(elapsedTimeInDays);
}
logActivity(elapsedTimeInDays);
```

## 1.2 Name collections, elements, and predicates explicitly

**Directive:** Name collections, elements, and status fields with the domain concepts and predicates they express.

**Rationale:** Names should explain why a value exists and what it represents without requiring a comment or a trace through the code.

### Anti-Pattern

```javascript
const r = u.filter((x) => x.s === "a");
```

### Enforced Pattern

```javascript
const activeUsers = users.filter((user) => user.status === "active");
```

## 1.3 Name calculations as readable formulas

**Directive:** Name operands and results so a calculation exposes its business meaning without requiring readers to decode symbols.

**Rationale:** Names should explain why a value exists and what it represents without requiring a comment or a trace through the code.

### Anti-Pattern

```javascript
const p = b * (1 - d) + s;
```

### Enforced Pattern

```javascript
const finalPrice = basePrice * (1 - discount) + shippingCost;
```

## 1.4 Do not mislabel data structures

**Directive:** Name each value after its actual structure or role, and never promise list semantics for a keyed object.

**Rationale:** Names must accurately describe the value they hold and must not create false expectations through misleading words, near-duplicates, or ambiguous characters.

### Anti-Pattern

```javascript
let accountList = {
  "user1": {name: "John", ...},
  "user2": {name: "Doe", ...},
};
```

### Enforced Pattern

```javascript
let accounts = {
  "user1": {name: "John", ...},
  "user2": {name: "Doe", ...},
};
```

## 1.5 Reject misleading and confusable names

**Directive:** Rename identifiers that misstate type or state, differ only by filler wording, or use visually confusable characters such as `l` and `1` or `O` and `0`.

**Rationale:** Names must accurately describe the value they hold and must not create false expectations through misleading words, near-duplicates, or ambiguous characters.

### Anti-Pattern

```javascript
let isComplete = "pending";
let userCount = { total: 42 };
let settingMap = true;
```

### Enforced Pattern

```javascript
let status = "pending";
let userStats = { total: 42 };
let debugEnabled = true;
```

## 1.6 Distinguish functions by behavior

**Directive:** Give related functions names that identify the distinct result or responsibility each one provides instead of adding filler variants or vague role suffixes.

**Rationale:** Different names should represent genuinely different behavior or responsibility, not meaningless variations or generic suffixes.

### Anti-Pattern

```javascript
function getUser() {...}
function getUserInfo() {...}
function getUserData() {...}
```

### Enforced Pattern

```javascript
function getUserProfile() {...}
function getUserPreferences() {...}
function getUserPermissions() {...}
```

## 1.7 Name parameters by semantic role

**Directive:** Name parameters by the roles they play rather than by position, sequence, or generic placeholders.

**Rationale:** Different names should represent genuinely different behavior or responsibility, not meaningless variations or generic suffixes.

### Anti-Pattern

```javascript
function filterAndMap(data1, data2, data3) {
  const result = data1.filter(data2).map(data3);
  return result;
}
```

### Enforced Pattern

```javascript
function filterAndMap(array, condition, transformation) {
  const result = array.filter(condition).map(transformation);
  return result;
}
```

## 1.8 Use pronounceable names

**Directive:** Replace compressed or vowel-stripped identifiers with natural-language names that teammates can say and remember.

**Rationale:** Names should sound like natural language so developers can discuss them in reviews, documentation, and everyday conversation.

### Anti-Pattern

```javascript
let genymdhms = new Date();
let prcsrr = new Processor();
let usrRcrds = [];
let dtaRcrd = fetchData();
```

### Enforced Pattern

```javascript
let generationTimestamp = new Date();
let processor = new Processor();
let userRecords = [];
let dataRecord = fetchData();
```

## 1.9 Use searchable names and constants

**Directive:** Use searchable domain names and named constants outside tiny local scopes instead of one-letter identifiers and unexplained numbers.

**Rationale:** The name should be long and specific enough to search for when its scope is larger than a short local context.

### Anti-Pattern

```javascript
for (let e = 0; e < 7; e++) {
  total += (data[e] * 4) / 5;
}
```

### Enforced Pattern

```javascript
for (let j = 0; j < NUMBER_OF_TASKS; j++) {
  let taskDays = taskEstimate[j] * DAYS_PER_IDEAL_DAY;
  let taskWeeks = taskDays / WORK_DAYS_PER_WEEK;
  sum += taskWeeks;
}
```

## 1.10 Remove type encodings from names

**Directive:** Let the type system and tooling expose implementation types while names communicate intent.

**Rationale:** Do not encode type information into names when the language, compiler, or IDE already exposes the type.

### Anti-Pattern

```typescript
let strFirstName: string;
let iAge: number;
let bIsLoggedIn: boolean;
let fAccountBalance: number;
```

### Enforced Pattern

```typescript
let firstName: string;
let age: number;
let isLoggedIn: boolean;
let accountBalance: number;
```

## 1.11 Eliminate mental translation tables

**Directive:** Replace abbreviations and symbolic parameters with domain terms so readers do not have to memorize private mappings.

**Rationale:** Readers should not have to translate cryptic abbreviations or single-letter variables into domain concepts before understanding the logic.

### Anti-Pattern

```javascript
function calculateTotal(p, t, q) {
  return (p + t) * q;
}
```

### Enforced Pattern

```javascript
function calculateTotal(price, tax, quantity) {
  return (price + tax) * quantity;
}
```

# 2. Functions and Control Flow

## 2.1 Keep functions small

**Directive:** Extract loops, branches, and low-level details behind well-named functions until the main function reads as a concise sequence of intent.

**Rationale:** Keep functions small by moving low-level details behind names that explain the operation being performed.

### Anti-Pattern

```javascript
async function uploadFile(file, userId) {
  const filePath = buildFilePath(file, userId);

  if (file.size > MAX_SINGLE_UPLOAD_SIZE) {
    const uploadId = await Storage.initMultipartUpload(filePath);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      await Storage.uploadPart(uploadId, i, chunk);
    }

    await Storage.completeMultipartUpload(uploadId);
    return { path: filePath, method: "multipart" };
  }

  await Storage.upload(filePath, file.buffer);
  return { path: filePath, method: "single" };
}
```

### Enforced Pattern

```javascript
async function uploadFile(file, userId) {
  const filePath = buildFilePath(file, userId);

  if (file.size > MAX_SINGLE_UPLOAD_SIZE) {
    return uploadFileInParts(file, filePath);
  }

  return uploadFileAsSinglePart(file, filePath);
}
```

## 2.2 Make each function do one thing

**Directive:** Extract every separately nameable responsibility and stop only when another extraction would merely restate the function’s existing purpose.

**Rationale:** A function should have one responsibility and should not contain a separately nameable concept that can be extracted without merely restating its implementation.

### Anti-Pattern

```javascript
function processOrder(order) {
  const inventory = database.getItems(order.itemIds);
  for (const item of inventory) {
    if (item.stock < order.qty) {
      throw new Error("Out of stock");
    }
  }

  const finalBill = calculateTotalBill(order);

  try {
    Stripe.charges.create({
      amount: finalBill * 100,
      source: order.paymentToken,
    });
  } catch (e) {
    throw new Error("Payment Failed");
  }

  Mailer.send({
    to: order.customerEmail,
    subject: "Order Confirmed",
    body: `Your total: ${finalBill}`,
  });
}
```

### Enforced Pattern

```javascript
function processOrder(order) {
  validateStockAvailability(order);
  const finalBill = calculateTotalBill(order);
  executeStripeCharge(order.customer.token, finalBill);
  notifyWarehouse(order);
}
```

## 2.3 Keep one abstraction level per function

**Directive:** Keep orchestration, domain decisions, and low-level API details in separate functions so code reads from high-level intent to implementation.

**Rationale:** Functions should tell a top-down story, with each function operating at one level of abstraction and delegating implementation details to lower-level functions.

### Anti-Pattern

```javascript
function processOrder(order) {
  const inventory = database.getItems(order.itemIds);
  for (const item of inventory) {
    if (item.stock < order.qty) {
      throw new Error("Out of stock");
    }
  }

  let subtotal = 0;
  for (const item of order.items) {
    const discount = applyDiscount(item.price);
    const tax = calculateTax(subtotal - discount);
    subtotal = item.price + tax;
  }

  try {
    Stripe.charges.create({
      amount: finalBill * 100,
      source: order.paymentToken,
    });
  } catch (e) {
    throw new Error("Payment Failed");
  }

  Mailer.send({
    to: order.customerEmail,
    subject: "Order Confirmed",
    body: `Your total: ${finalBill}`,
  });
}
```

### Enforced Pattern

```javascript
function processOrder(order) {
  validateStockAvailability(order);
  const finalBill = calculateTotalBill(order);
  executeStripeCharge(order.customer.token, finalBill);
  notifyWarehouse(order);
}
```

## 2.4 Replace repeated type switches with owned behavior

**Directive:** Replace repeated type-based switches with polymorphic behavior owned by each type, while leaving a single simple switch alone until repetition creates the smell.

**Rationale:** Replace repeated type switches with polymorphic objects so the type-specific behavior lives with the type that owns it.

### Anti-Pattern

```typescript
function calculatePay(employee) {
  switch (employee.type) {
    case "fullTime":
      return employee.salary / 12;
    case "partTime":
      return employee.hours * employee.rate;
    case "contractor":
      return employee.hours * employee.contractRate;
  }
}
```

### Enforced Pattern

```typescript
class EmployeeFactory {
  // The switch lives here—and ONLY here
  create(type, data): Employee {
    switch (type) {
      case "fullTime":
        return new FullTimeEmployee(data);
      case "partTime":
        return new PartTimeEmployee(data);
      case "contractor":
        return new Contractor(data);
    }
  }
}

const contractor = factory.create("contractor", data);
contractor.calculatePay();
contractor.getBenefits();
contractor.getSchedule();
```

## 2.5 Refactor in small verified increments

**Directive:** Refactor through small behavior-preserving steps backed by tests or equivalent checks instead of rewriting working code in one unverified pass.

**Rationale:** Clean code is usually rewritten into shape through small, test-backed refactorings rather than written perfectly on the first attempt.

### Anti-Pattern

```javascript
function processOrders(orders) {
  for (const order of orders) {
    if (order.isValid) {
      save(order);
      notify(order);
    }
  }
}
```

### Enforced Pattern

```javascript
function processOrders(orders) {
  const validOrders = orders.filter(isValidOrder);
  validOrders.forEach(processOrder);
}

function processOrder(order) {
  save(order);
  notify(order);
}
```

# 3. Arguments and Side Effects

## 3.1 Keep argument lists short

**Directive:** Prefer zero to two arguments and group three or more related values into a named object instead of passing an ordered bag of primitives.

**Rationale:** Zero arguments is ideal, one is clear, two can be acceptable, and three or more usually signal that related values should become an object.

### Anti-Pattern

```javascript
saveUser(name, email, age, city, isPremium);
```

### Enforced Pattern

```javascript
saveUser(user);
```

## 3.2 Remove flag and output arguments

**Directive:** Use arguments as clear inputs to a question, transformation, or event, replace boolean code-path flags with separately named operations, and return results instead of mutating output parameters.

**Rationale:** Boolean flags hide alternate responsibilities, while output arguments violate the normal expectation that data flows in through parameters and out through return values.

### Anti-Pattern

```javascript
createUser(true);
findMax(numbers, result);
```

### Enforced Pattern

```javascript
createAdminAccount();

function findMax(numbers) {
  return Math.max(numbers);
}
```

## 3.3 Make argument relationships explicit

**Directive:** Group related values into a named concept, move an operation onto the object that owns the dependency, and use a rigid natural order for any unavoidable three-argument call.

**Rationale:** Related values can be grouped, but unrelated pairs and ambiguous triads should be made explicit through ownership, names, and a predictable ordering.

### Anti-Pattern

```javascript
sendEmail(message, smtp);
```

### Enforced Pattern

```javascript
smtp.sendEmail(message);
```

## 3.4 Expose side effects at the call site

**Directive:** Keep checks, queries, and calculations free of unrelated state changes, and invoke mutations as separate named operations.

**Rationale:** A function should do what its name promises; a check should not silently initialize a session or mutate object state.

### Anti-Pattern

```javascript
function checkPassword(password) {
  if (password === storedPassword) {
    Session.initialize();
    return true;
  }
  return false;
}
```

### Enforced Pattern

```javascript
function checkPassword(password) {
  if (password === storedPassword) {
    return true;
  }
  return false;
}

if (checkPassword(password)) {
  initializeSession();
}
```

## 3.5 Separate commands from queries

**Directive:** Use one operation to answer a question and another to change state so a query can never mutate data unexpectedly.

**Rationale:** Commands change state and queries return answers; combining them makes a call impossible to reason about safely.

### Anti-Pattern

```javascript
function setAndCheckIfExists(attribute, value) {
  const existed = data[attribute] !== undefined;
  data[attribute] = value;
  return existed;
}
```

### Enforced Pattern

```javascript
if (!attributeExists("role")) {
  setAttribute("role", "admin");
}
```

# 4. Duplication and Refactoring

## 4.1 Keep each rule in one authoritative place

**Directive:** Extract duplicated knowledge only when the copies represent the same rule, protocol, validation, timeout, mapping, or error policy.

**Rationale:** Each piece of knowledge should have one authoritative representation so a change such as a timeout is made in one place.

### Anti-Pattern

```javascript
async function getUsers() {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error();
  return res.json();
}

async function getPosts() {
  const res = await fetch("/api/posts");
  if (!res.ok) throw new Error();
  return res.json();
}
```

### Enforced Pattern

```javascript
async function fetchData(endpoint, timeout = 5000) {
  const res = await fetch(endpoint, { timeout });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function getUsers() {
  return fetchData("/api/users");
}

async function getPosts() {
  return fetchData("/api/posts");
}
```

# 5. Comments and Documentation

## 5.1 Delete stale comments

**Directive:** Remove comments that no longer match the code and keep comments only for information the code cannot express directly.

**Rationale:** Comments can become stale and misleading as code changes, so they should exist only when they communicate something the code cannot.

### Anti-Pattern

```javascript
// Returns active users.
function getUsers() {
  return users;
}
```

### Enforced Pattern

```javascript
function getUsers() {
  return users;
}
```

## 5.2 Comment non-obvious constraints

**Directive:** Add a local comment when a business rule, warning, comparison, or non-intuitive constraint cannot be made clear through code alone.

**Rationale:** Useful comments preserve business constraints, warnings, or non-intuitive rules that cannot be inferred from the implementation alone.

### Anti-Pattern

```javascript
expect(a.compareTo(b)).toBe(-1);
```

### Enforced Pattern

```javascript
// a < b
expect(a.compareTo(b)).toBe(-1);
```

## 5.3 Write actionable warnings and TODOs

**Directive:** State the operational cost or external blocker, the affected behavior, and the condition for removal instead of leaving vague future-work notes.

**Rationale:** Warnings should explain a real operational constraint, and TODOs should record a specific reason the work cannot yet be completed.

### Anti-Pattern

```javascript
function testWithReallyBigFile() {
  writeLinesToFile(10_000_000);
}
```

### Enforced Pattern

```javascript
// WARNING: Takes too long to run.
// Skip during test cycles.
function testWithReallyBigFile() {
  writeLinesToFile(10_000_000);
}
```

## 5.4 Document public APIs

**Directive:** Document externally consumed APIs with their purpose, inputs, outputs, failures, and usage, and use a standard license header when legal attribution is required.

**Rationale:** Public APIs need documentation describing purpose, inputs, outputs, failures, and usage; legal headers should use standard licenses.

### Anti-Pattern

```javascript
function fetchUser(id) {
  // ... implementation
}
```

### Enforced Pattern

```javascript
/**
 * Fetches a user by identifier.
 * @param {string} id - The user identifier.
 * @returns {Promise<User>} The requested user.
 */
function fetchUser(id) {
  // ... implementation
}
```

## 5.5 Remove redundant comments

**Directive:** Delete comments that restate visible control flow or syntax without adding context.

**Rationale:** A comment that repeats the code adds scanning and maintenance cost without adding understanding.

### Anti-Pattern

```javascript
// if there are no items in the cart,
// return early.
if (cart.items.length === 0) {
  return;
}
```

### Enforced Pattern

```javascript
if (cart.items.length === 0) {
  return;
}
```

## 5.6 Remove misleading or partial comments

**Directive:** Delete or rewrite comments that describe only part of the behavior, rely on remote context, or create confidence the implementation does not support.

**Rationale:** Comments must be specific, obvious, and local; otherwise they create false confidence or force the reader to guess what they mean.

### Anti-Pattern

```javascript
// Returns the discount
// percentage for premium users
function getDiscount(user) {
  if (user.isPremium) return 20;
  return 5;
}
```

### Enforced Pattern

```javascript
function getDiscount(user) {
  if (user.isPremium) return 20;
  return 5;
}
```

## 5.7 Delete commented-out code

**Directive:** Remove disabled implementations, author ownership markers, and edit-history fragments from active source files and rely on version control for retrieval.

**Rationale:** Deleted code belongs in version control, not in the active source file alongside code that actually runs.

### Anti-Pattern

```javascript
// function getUserInfo() { ... }
// const oldValue = getLegacyValue();
function getUser(id) {
  return loadUser(id);
}
```

### Enforced Pattern

```javascript
function getUser(id) {
  return loadUser(id);
}
```

## 5.8 Refactor code that needs structural apology comments

**Directive:** Replace closing-brace labels and unnecessary position markers with smaller functions and clearer structure, except where framework-required boilerplate needs stable grouping.

**Rationale:** Closing-brace comments and position markers usually indicate that the function or file needs structural refactoring rather than more labels.

### Anti-Pattern

```javascript
function generateReport(data) {
  if (data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      try {
        if (data[i].isValid()) {
          while (data[i].hasNext()) {
            process(data[i]);
          } // end while hasNext
        } // end if isValid
      } catch (e) {
        // error handling ...
      } // end for
    } // end if data
  } // end generateReport
}
```

### Enforced Pattern

```javascript
function generateReport(data) {
  const validItems = filterValid(data);
  const results = processItems(validItems);
  return buildReport(results);
}
```

## 5.9 Keep comments local, specific, and editor-readable

**Directive:** Replace vague ownership history, uncertain prose, and HTML-heavy formatting with concise plain-text context located beside the code it governs.

**Rationale:** Replace vague comments with actionable TODOs, remove irrelevant history, and use plain text that remains readable in the editor.

### Anti-Pattern

```javascript
// R.J. said this might cause a race condition if the server is slow.
// I tried to fix it but not sure if it works for the edge case.
// load the user data
if (user.id) {
  loadData(user.id);
}
```

### Enforced Pattern

```javascript
// TODO: Add a timeout check here.
// Currently, if the server response is slow, the UI freezes.
if (user.id) {
  loadData(user.id);
}
```

# 6. Formatting and Locality

## 6.1 Order files from intent to detail

**Directive:** Place the highest-level operation first, define supporting functions below their callers, and keep related helpers adjacent.

**Rationale:** Put the highest-level function first, define supporting functions below their callers, and group conceptually related helpers together.

### Anti-Pattern

```javascript
function fetchUserData(userId) {
  // ... get data from the database
}

function saveReport(reportText) {
  // ... save to the database
}

function processUserReport(userId) {
  let rawData = fetchUserData(userId);
  let report = buildReport(rawData);
  saveReport(report);
}

function buildReport(data) {
  let cleanDate = formatDate(data.date);
  let cleanScore = formatScore(data.score);
  return data.name + ": " + cleanDate + " " + cleanScore;
}
```

### Enforced Pattern

```javascript
function processUserReport(userId) {
  let rawData = fetchUserData(userId);
  let report = buildReport(rawData);
  saveReport(report);
}

function fetchUserData(userId) {
  // ... get data from the database
}

function buildReport(data) {
  let cleanDate = formatDate(data.date);
  let cleanScore = formatScore(data.score);
  return data.name + ": " + cleanDate + " " + cleanScore;
}

function saveReport(reportText) {
  // ... save to the database
}
```

## 6.2 Use spacing and indentation to expose structure

**Directive:** Separate concepts with blank lines, keep tightly related statements together, indent every nested scope consistently, follow the repository formatter, and avoid churn-only formatting diffs.

**Rationale:** Blank lines separate concepts, dense lines keep related operations together, and indentation makes scope visible at a glance.

### Anti-Pattern

```typescript
import { User } from '../models';
import { CacheConfig } from '../config';
class UserProfileService {
private user: User;
private cache: Map<string, string>;
private isInitialized: boolean;
constructor(user: User) {...}
generateUserProfileBadge() {...}
getDisplayName() {...}
updateUsername(newUsername: string) {...}
deleteProfile() {...}
}
```

### Enforced Pattern

```typescript
import { User } from '../models';
import { CacheConfig } from '../config';

class UserProfileService {
  private user: User;
  private cache: Map<string, string>;
  private isInitialized: boolean;

  constructor(user: User) {...}

  generateUserProfileBadge() {...}

  getDisplayName() {...}

  updateUsername(newUsername: string) {...}

  deleteProfile() {...}
}
```

## 6.3 Declare values near their use

**Directive:** Introduce local variables immediately before their use while keeping shared class fields in the repository’s designated field area.

**Rationale:** Local variables should be introduced where they are needed, while shared class properties should stay in the class’s designated field area.

### Anti-Pattern

```javascript
let skippedLog;
let report;

// ... other processing

if (hasDuplicates) {
  skippedLog = buildDuplicateReport();
  notifyAdmin(skippedLog);
}

// ... more processing

report = buildImportReport(validated, rows);
archiveReport(report);
return report;
```

### Enforced Pattern

```javascript
// ... other processing

if (hasDuplicates) {
  const skippedLog = buildDuplicateReport();
  notifyAdmin(skippedLog);
}

// ... more processing

const report = buildImportReport(validated, rows);
archiveReport(report);
return report;
```

# 7. Objects and Data

## 7.1 Protect coordinated state changes behind behavior

**Directive:** Do not add independent getters and setters automatically; hide representation and expose operations that preserve valid state transitions.

**Rationale:** Abstraction should hide representation and expose what callers can do, including access policies and meaningful behavior.

### Anti-Pattern

```java
public class Point {
  public double x;
  public double y;
}
```

### Enforced Pattern

```java
public interface Point {
  double getX();
  double getY();
  void setCartesian(double x, double y);
  double getR();
  double getTheta();
  void setPolar(double r, double theta);
}
```

## 7.2 Expose domain behavior instead of storage units

**Directive:** Return the domain fact callers need instead of leaking the units, fields, or persistence representation used internally.

**Rationale:** Abstraction should hide representation and expose what callers can do, including access policies and meaningful behavior.

### Anti-Pattern

```java
public interface Vehicle {
  public double getFuelTankCapacityInGallons();
  public double getGallonsOfGasoline();
}
```

### Enforced Pattern

```java
public interface Vehicle {
  double getPercentFuelRemaining();
}
```

## 7.3 Choose objects or data structures by expected change

**Directive:** Choose data structures plus procedures when new operations are likely and choose behavior-owning objects when new types are likely.

**Rationale:** Procedural designs make adding operations easy, while object-oriented designs make adding types easy; choose based on the change most likely to come next.

### Anti-Pattern

```java
class Square {
  public double side;
}

class Rectangle {
  public double height;
  public double width;
}

class Circle {
  public double radius;
}

class Geometry {
  double area(Object s) {
    if (s instanceof Square)
      return s.side * s.side;
    if (s instanceof Rectangle)
      return s.height * s.width;
    if (s instanceof Circle)
      return PI * s.radius * s.radius;
  }
}
```

### Enforced Pattern

```java
class Square implements Shape {
  private double side;

  double area() {
    return side * side;
  }
}

class Rectangle implements Shape {
  private double height;
  private double width;

  double area() {
    return height * width;
  }
}

class Circle implements Shape {
  private double radius;

  double area() {
    return PI * radius * radius;
  }
}
```

## 7.4 Talk only to immediate collaborators

**Directive:** For behavior-hiding objects, ask the owning collaborator for the result you need instead of navigating through chains of returned objects.

**Rationale:** Talk to immediate collaborators and tell an object what you need instead of reaching through a chain of returned objects.

### Anti-Pattern

```javascript
let outputDir = ctxt.getOptions().getScratchDir().getAbsolutePath();
```

### Enforced Pattern

```javascript
let outputDir = ctxt.getAbsolutePathForScratchDirectoryOption();
```

## 7.5 Keep objects and data structures pure

**Directive:** Make objects hide data and expose behavior, make data structures expose data with little behavior, and keep business rules out of DTOs and active records.

**Rationale:** Objects hide data and expose behavior, while data structures expose data and avoid behavior; hybrid classes lose the advantages of both designs.

### Anti-Pattern

```java
class Product {
  private String name;
  private double price;

  String getName() { return name; }
  double getPrice() { return price; }
  void setPrice(double p) { price = p; }

  double applyDiscount(double pct) {
    return price * (1 - pct / 100);
  }
}
```

### Enforced Pattern

```java
class Product extends ActiveRecord {
  private String name;
  private double price;

  void save() { ... }
  void delete() { ... }
}

class ProductPricing {
  double applyDiscount(Product p, double pct) {
    return p.getPrice() * (1 - pct / 100);
  }
}
```

# 8. Error Handling

## 8.1 Replace nested error-code branches with exceptions

**Directive:** Use exceptions for real failures so the normal path stays flat and callers are not coupled to shared error-code enums.

**Rationale:** Exceptions keep the normal path flat and localize error handling instead of forcing every caller through nested status checks and shared error enums.

### Anti-Pattern

```javascript
if (createAccount(userData) == ErrorCode.OK) {
  if (createProfile(userData) == ErrorCode.OK) {
    if (sendWelcomeEmail(userData.email) == ErrorCode.OK) {
      return ErrorCode.OK;
    } else {
      return ErrorCode.EMAIL_FAILED;
    }
  } else {
    return ErrorCode.PROFILE_FAILED;
  }
} else {
  return ErrorCode.ACCOUNT_FAILED;
}
```

### Enforced Pattern

```javascript
function registerUser(userData) {
  try {
    performRegistration(userData);
  } catch (error) {
    showError(error.message);
  }
}

function performRegistration(userData) {
  createAccount(userData);
  createProfile(userData);
  sendWelcomeEmail(userData.email);
  redirectToDashboard();
}
```

## 8.2 Separate the algorithm from its failure boundary

**Directive:** Move failure handling into one exception boundary so the successful algorithm remains visible as a direct sequence of steps.

**Rationale:** Keep the algorithm readable by moving failure handling out of every normal-processing step and into one exception boundary.

### Anti-Pattern

```javascript
function sendMessage(msg) {
  const sender = verifySession(msg.token);
  if (sender === null) {
    return "expired";
  }
  const channel = resolveChannel(msg.to);
  if (channel.active === false) {
    return "closed";
  }
  const content = moderate(msg.text);
  if (content.ok) {
    broadcast(channel, sender, content);
    return "sent";
  } else {
    return "blocked";
  }
}
```

### Enforced Pattern

```javascript
function sendMessage(msg) {
  try {
    deliverMessage(msg);
  } catch (error) {
    notifySender(msg.token, error);
  }
}

function deliverMessage(msg) {
  const sender = verifySession(msg.token);
  const channel = resolveChannel(msg.to);
  const content = moderate(msg.text);
  broadcast(channel, sender, content);
}
```

## 8.3 Define exception contracts at the boundary

**Directive:** Translate internal failures into the stable exception type promised by the public operation and verify that contract with failure tests.

**Rationale:** Define the exception contract and failure test before filling in the implementation so callers know exactly what the function can throw.

### Anti-Pattern

```javascript
function withdraw(accountId, amount) {
  const account = await db.load(accountId);
  account.assertActive();
  account.debit(amount);
  await db.save(account);
}
```

### Enforced Pattern

```javascript
function withdraw(accountId, amount) {
  try {
    const account = await db.load(accountId);
    account.assertActive();
    account.debit(amount);
    await db.save(account);
  } catch (e) {
    throw new TransactionFailed(e);
  } finally {
    await lock.release(accountId);
  }
}
```

## 8.4 Translate third-party exceptions only at a real boundary

**Directive:** Wrap library-specific exceptions in application-owned failures only when those types would otherwise leak across multiple callers or destabilize the application contract.

**Rationale:** Translate library-specific exception types at a wrapper boundary so the rest of the application depends on exceptions chosen by the application.

### Anti-Pattern

```java
S3Client s3 = new S3Client(region);
try {
  s3.getObject(key);
} catch (NoSuchKeyException e) {
  notifyOps(e);
} catch (SdkClientException e) {
  notifyOps(e);
} catch (S3Exception e) {
  notifyOps(e);
}
```

### Enforced Pattern

```java
class ObjectStore {
  S3Client s3;

  File fetch(String key) {
    try {
      return s3.getObject(key);
    } catch (NoSuchKeyException e) {
      throw new StorageFailure(e);
    } catch (SdkClientException e) {
      throw new StorageFailure(e);
    } catch (S3Exception e) {
      throw new StorageFailure(e);
    }
  }
}

ObjectStore store = new ObjectStore();
try {
  store.fetch(key);
} catch (StorageFailure e) {
  notifyOps(e);
  logger.log("Fetch failed", e);
}
```

## 8.5 Model expected alternatives without exceptions

**Directive:** Return a default or special-case object for routine alternate outcomes instead of using catch blocks as ordinary conditional branches.

**Rationale:** Do not use exceptions for normal alternatives such as a missing regional tax rule; return a default object with the same interface instead.

### Anti-Pattern

```java
TaxRule rule;
double tax;
try {
  rule = taxRules.findFor(region);
  tax = rule.calculate(subtotal);
} catch (NoRuleFound e) {
  tax = subtotal * STANDARD_RATE;
}
total += tax;
```

### Enforced Pattern

```java
TaxRule findFor(String region) {
  if (rules.containsKey(region)) {
    return rules.get(region);
  }
  return new StandardTaxRule();
}

class StandardTaxRule implements TaxRule {
  public double calculate(double subtotal) {
    return subtotal * STANDARD_RATE;
  }
}
```

## 8.6 Return sensible empty values for normal absence

**Directive:** Return empty collections, zero values, or another neutral value when absence is normal, use explicit optional values when absence is meaningful, and throw only for actual failures.

**Rationale:** Use sensible empty values such as an empty list or zero where absence is normal, and reserve exceptions for failures that should not be silently ignored.

### Anti-Pattern

```java
List<Order> orders = customer.getOrders();
if (orders != null) {
  for (Order o : orders) {
    Double discount = o.getDiscount();
    if (discount != null) {
      total += o.getAmount() - discount;
    }
  }
}
```

### Enforced Pattern

```java
List<Order> orders = customer.getOrders();
for (Order o : orders) {
  Double discount = o.getDiscount();
  total += o.getAmount() - discount;
}

public List<Order> getOrders() {
  if (orders == null) return List.of();
  return orders;
}

public Double getDiscount() {
  if (discount == null) return 0.0;
  return discount;
}
```
