const express = require('express');
const path = require('path');
require('dotenv').config();

const connectDB = require('./server/database/connection');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 3000

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'views'));

//load assets
app.use('/css', express.static(path.resolve(__dirname, 'assets/css')));
app.use('/images', express.static(path.resolve(__dirname, 'assets/images')));
app.use('/js', express.static(path.resolve(__dirname, 'assets/js')));

app.use('/', require('./server/routes/router'))

//connection
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`server is running on http://localhost:${PORT}`);
    })
    }
).catch((err) => {
    console.log(err);
})