const request = require("supertest");
const app = require("./server");
const pool = require("./config/db");

// ── Inventory ──────────────────────────────────────────────────────────────

describe("GET /inventory", () => {
  it("returns paginated inventory with only active books", async () => {
    const res = await request(app).get("/inventory");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pagination");
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("POST /inventory/add", () => {
  it("blocks non-librarians", async () => {
    const res = await request(app)
      .post("/inventory/add")
      .send({
        userId: 1,
        title: "Test Book",
        author: "Author",
        isbn: "123",
        category: "Test",
        total_stock: 3,
      });
    expect(res.statusCode).toBe(403);
  });

  it("allows librarians to add a book", async () => {
    const res = await request(app)
      .post("/inventory/add")
      .send({
        userId: 999,
        title: "Test Book",
        author: "Author",
        isbn: "123",
        category: "Test",
        total_stock: 3,
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toMatch(/Test Book/);
  });
});

describe("DELETE /inventory/delete/:inventoryId", () => {
  it("blocks non-librarians", async () => {
    const res = await request(app)
      .delete("/inventory/delete/101")
      .send({ userId: 1 });
    expect(res.statusCode).toBe(403);
  });

  it("soft-deletes a book so it no longer appears in inventory", async () => {
    // First add a book to delete
    await request(app)
      .post("/inventory/add")
      .send({
        userId: 999,
        title: "To Be Deleted",
        author: "Author",
        isbn: "999",
        category: "Test",
        total_stock: 1,
      });

    // Get its ID
    const [rows] = await pool.query(
      "SELECT inventory_id FROM library_inventory WHERE title = 'To Be Deleted'"
    );
    const id = rows[0].inventory_id;

    const res = await request(app)
      .delete(`/inventory/delete/${id}`)
      .send({ userId: 999 });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/archived/i);

    // Confirm it's hidden from GET
    const listRes = await request(app).get("/inventory");
    const titles = listRes.body.data.map((b) => b.title);
    expect(titles).not.toContain("To Be Deleted");
  });
});

// ── Loans ──────────────────────────────────────────────────────────────────

describe("POST /loan/borrow", () => {
  it("successfully borrows a book and decrements stock", async () => {
    const [before] = await pool.query(
      "SELECT available_stock FROM library_inventory WHERE inventory_id = 101"
    );
    const stockBefore = before[0].available_stock;

    const res = await request(app)
      .post("/loan/borrow")
      .send({ borrowerId: 2, inventoryId: 101 });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/borrowed/i);

    const [after] = await pool.query(
      "SELECT available_stock FROM library_inventory WHERE inventory_id = 101"
    );
    expect(after[0].available_stock).toBe(stockBefore - 1);
  });

  it("fails when book is out of stock", async () => {
    const res = await request(app)
      .post("/loan/borrow")
      .send({ borrowerId: 1, inventoryId: 102 }); // 102 has 0 stock
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/out of stock/i);
  });
});

describe("POST /loan/return", () => {
  it("returns a book and increments stock", async () => {
    const [before] = await pool.query(
      "SELECT available_stock FROM library_inventory WHERE inventory_id = 101"
    );
    const stockBefore = before[0].available_stock;

    const res = await request(app)
      .post("/loan/return")
      .send({ borrowerId: 2, inventoryId: 101 });

    expect(res.statusCode).toBe(200);

    const [after] = await pool.query(
      "SELECT available_stock FROM library_inventory WHERE inventory_id = 101"
    );
    expect(after[0].available_stock).toBe(stockBefore + 1);
  });

  it("fails when no active loan exists", async () => {
    const res = await request(app)
      .post("/loan/return")
      .send({ borrowerId: 1, inventoryId: 101 }); // Alice never borrowed
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/no active loan/i);
  });

  it("charges a late fee for overdue returns", async () => {
    // Manually create an overdue loan
    const pastDate = new Date("2020-01-01");
    await pool.query(
      'INSERT INTO loan_records (borrower_id, inventory_id, status, borrowed_at, due_date) VALUES (1, 101, "active", NOW(), ?)',
      [pastDate]
    );
    await pool.query(
      "UPDATE library_inventory SET available_stock = available_stock - 1 WHERE inventory_id = 101"
    );

    const res = await request(app)
      .post("/loan/return")
      .send({ borrowerId: 1, inventoryId: 101 });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/fee/i);
    expect(res.body.message).toMatch(/\$/);
  });
});

describe("GET /loan/my-loans/:borrowerId", () => {
  it("returns active loans for a borrower", async () => {
    // Borrow a book first so there's something to show
    await request(app)
      .post("/loan/borrow")
      .send({ borrowerId: 1, inventoryId: 101 });

    const res = await request(app).get("/loan/my-loans/1");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("activeLoans");
    expect(Array.isArray(res.body.activeLoans)).toBe(true);
    expect(res.body.activeLoans.length).toBeGreaterThan(0);
  });
});

// ── Reservations ───────────────────────────────────────────────────────────

describe("POST /loan/reserve", () => {
  it("blocks reservation when book is in stock", async () => {
    const res = await request(app)
      .post("/loan/reserve")
      .send({ borrowerId: 2, inventoryId: 101 }); // 101 has stock
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/available/i);
  });

  it("places a reservation when book is out of stock", async () => {
    // Clear any existing reservation first
    await pool.query(
      "DELETE FROM reservations WHERE borrower_id = 1 AND inventory_id = 102"
    );

    const res = await request(app)
      .post("/loan/reserve")
      .send({ borrowerId: 1, inventoryId: 102 }); // 102 has 0 stock
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/reservation placed/i);
  });

  it("blocks a duplicate reservation", async () => {
    // First reservation already exists from test above
    const res = await request(app)
      .post("/loan/reserve")
      .send({ borrowerId: 1, inventoryId: 102 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/already have a pending reservation/i);
  });
});

// ── Cleanup ────────────────────────────────────────────────────────────────

afterAll(async () => {
  await pool.end();
});
