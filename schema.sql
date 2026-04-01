-- 1. CLEANUP (Drop tables in correct order)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS loan_records;
DROP TABLE IF EXISTS library_inventory;
DROP TABLE IF EXISTS borrowers;
SET FOREIGN_KEY_CHECKS = 1;

-- 2. CREATE DATABASE (Optional if already selected)
CREATE DATABASE IF NOT EXISTS library_db;
USE library_db;

-- 3. CREATE TABLES

-- Table: Borrowers
CREATE TABLE borrowers (
    borrower_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL, 
    email VARCHAR(100) UNIQUE,
    password VARCHAR(100), 
    role VARCHAR(50) DEFAULT 'user',
    registered_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: Inventory (Upgraded with Soft Deletes)
CREATE TABLE library_inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    author VARCHAR(255),  
    isbn VARCHAR(50),     
    category VARCHAR(50),
    total_stock INT DEFAULT 0,
    available_stock INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE -- The bouncer: keeps deleted books hidden but preserves history
);

-- Table: Loan Records
CREATE TABLE loan_records (
    loan_id INT AUTO_INCREMENT PRIMARY KEY,
    borrower_id INT,
    inventory_id INT,
    status VARCHAR(50) DEFAULT 'active', 
    borrowed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME, 
    returned_at DATETIME,
    late_fee DECIMAL(10, 2) DEFAULT 0.00,
    FOREIGN KEY (borrower_id) REFERENCES borrowers(borrower_id),
    FOREIGN KEY (inventory_id) REFERENCES library_inventory(inventory_id)
);

-- Performance Index: This stops the Full Table Scan on returns
CREATE INDEX idx_active_loans ON loan_records(borrower_id, inventory_id, status);

-- Table: Reservations
CREATE TABLE reservations (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    borrower_id INT,
    inventory_id INT,
    reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    FOREIGN KEY (borrower_id) REFERENCES borrowers(borrower_id),
    FOREIGN KEY (inventory_id) REFERENCES library_inventory(inventory_id)
);

-- 4. INSERT DUMMY DATA (Crucial for Postman)

-- Insert Users
-- ID 1 = Alice (The standard user for testing)
-- ID 999 = Librarian Sarah (For testing the delete route)
INSERT INTO borrowers (borrower_id, name, email, password, role) VALUES 
(1, 'Alice Carter', 'alice@uni.edu', 'pass123', 'user'),
(2, 'Bob Dawson', 'bob@uni.edu', 'pass123', 'user'),
(999, 'Librarian Sarah', 'sarah@uni.edu', 'adminpass', 'librarian');

-- Insert Books
-- ID 101 = The book Alice will borrow
-- ID 102 = The Out of Stock book (for testing reservations)
INSERT INTO library_inventory (inventory_id, title, author, isbn, category, total_stock, available_stock) VALUES 
(101, 'Introduction to Algorithms', 'Thomas H. Cormen', '9780262033848', 'Textbook', 5, 5),
(102, 'Clean Code', 'Robert C. Martin', '9780132350884', 'Textbook', 2, 0);