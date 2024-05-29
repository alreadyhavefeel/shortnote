import pg from 'pg';
import express, { query } from 'express';
import bodyParser from 'body-parser';
import ejs, { render } from 'ejs';
import axios from 'axios';
import morgan from 'morgan';


const app = express();
const port = 3000;
const API_URL = "https://covers.openlibrary.org";

app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const pool = new pg.Pool({
    user: "postgres",
    host: "localhost",
    database: "haveread",
    password: "1997",
    port: 5432,
});

const key = "isbn";
const value = "0385472579";

async function getBooks() {
    const result = await pool.query("SELECT * FROM books");
    let books = [];
    result.rows.forEach((book) => {
        books.push(book);
    });
    return books;
}

app.get("/", async (req, res) => {
    const books = await getBooks();
    const url = `${API_URL}/b/isbn/${books.isbn}-M.jpg`
    res.render("index.ejs", {
        imageUrl: url,
        books: books,
    });
});

async function getBookreviews(bookId) {
    const result = await pool.query(`
    SELECT book_reviews.id, book_reviews.review_book, book_reviews.bookid, books.bookname, books.isbn, books.shortdescription, users.name FROM book_reviews 
    JOIN books ON books.id = book_reviews.bookid 
    JOIN users ON users.id = book_reviews.userid WHERE book_reviews.bookid = $1`, [bookId]);
    let reviews = [];
    result.rows.forEach((review) => {
        reviews.push(review);
    });
    return reviews;
}

app.route("/reviews")
    .post(async (req, res) => {
        const bookId = req.body.bookId;
        if (!bookId) {
            res.status(400).send("Book ID is required");
            return;
        }
        const books = await getBooks();
        const reviews = await getBookreviews(bookId);
        res.render("reviews.ejs", { books: books.slice(bookId-1, bookId),reviews: reviews });
    })
    .get(async (req, res) => {
        const bookId = req.query.bookId;
        if (!bookId) {
            res.status(400).send("Book ID is required");
            return;
        }
        const books = await getBooks();
        const reviews = await getBookreviews(bookId);
        console.log("This is from get"+ books);
        console.log("This is from get"+ reviews);
        res.render("reviews.ejs", { books: books.slice(bookId-1, bookId), reviews });
    });

app.post("/addreview", async (req, res) => {
    const bookId = req.body.bookId;
    const userName = req.body.userName;
    const review = req.body.review;
    const datetime = new Date().toISOString().split('T')[0];
    try {
        await pool.query("INSERT INTO book_reviews (review_book, bookid, userid, last_update) VALUES ($1, $2, $3, $4)", [review, bookId, userName, datetime]);
        console.log("Review added successfully");
        res.redirect(`/reviews?bookId=${bookId}`);
    } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/addnewbook" , async (req, res) => {
    res.render("addNewbook.ejs");
});

app.post("/newbook" , async (req, res) => {
    const bookName = req.body.bookName;
    const isbn = req.body.isbn;
    const shortDescription = req.body.shortDescription;
    const datetime = new Date().toISOString().split('T')[0];
    try {
        await pool.query("INSERT INTO books (bookname, isbn, shortdescription, last_update) VALUES ($1, $2, $3, $4)", [bookName, isbn, shortDescription, datetime]);
    } catch (error) {
        console.log(error);
    } finally {
        console.log("Book added successfully");
        res.redirect("/");
    }
});

async function getReview(reviewId) {
    const result = await pool.query("SELECT * FROM book_reviews WHERE id = $1", [reviewId]);
    return result.rows[0];
}

app.post('/edit/:id', async (req, res) => {
    const reviewId = req.params.id;
    const review = await getReview(reviewId);
    res.render("editreview.ejs", { review });
    console.log(review);
    // Handle the edit logic here (e.g., updatecd  the review in the database)

    //res.send(`Review with ID ${reviewId} has been edited.`);
});

app.post('/editreview/:id', async (req, res) => {
    const reviewId = req.params.id;
    const review = req.body.review;
    const bookId = req.body.bookId;
    console.log(reviewId, review, bookId);
    await pool.query("UPDATE book_reviews SET review_book = $1 WHERE id = $2", [review, reviewId]);
    res.redirect(`/reviews?bookId=${bookId}`);
    console.log("Review updated successfully");
});

// Route to delete a review
app.post('/deletereview/:id', async (req, res) => {
    const reviewId = req.params.id;
    const bookId = req.body.bookId;
    await pool.query("DELETE FROM book_reviews WHERE id = $1", [reviewId]);
    //query = `DELETE FROM book_reviews WHERE id = $1`;
    // Handle the delete logic here (e.g., delete the review from the database)
    res.redirect(`/reviews?bookId=${bookId}`);
    console.log(`Review deleted ID ${reviewId} successfully`);
});


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });