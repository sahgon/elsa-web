if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const passport = require('passport');
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const path = require('path')
const { 
    v1: uuidv1,
    v4: uuidv4,
} = require('uuid');

const initializePassport = require('./passport-config');
initializePassport(
    passport,
    email => users.find(user => user.email === email),
    id => users.find(user => user.id === id)
);

const users = [{ id: 1, name: 'Konstantinos', email: 'k@k', password: '1', availability: [] }]
const orders = []
const toDeliver = []
const toReceive = []

app.use('/views', express.static(__dirname + "/views"));
app.set('view-engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

// Database stuff
var sql = require('mssql');

var sqlConfig = {
    user: 'elsa',
    password: 'elsa',
    server: `DESKTOP-SAHGON\\SAHGONMSSQL`,  
    database: 'Elsa',
    trustServerCertificate: true,
};

app.get('/s', (req, res) => {
    // (async function () {
    //     try {
    //         console.log("sql connecting...")
    //         console.log(`INSERT INTO [Elsa].[dbo].[Test] VALUES (100, 'Michael');`)
    //         let pool = await sql.connect(sqlConfig)
    //         let result = await pool.request()
    //             .query(`INSERT INTO [Elsa].[dbo].[Orders] VALUES ('${uuidv4()}', 'test_packet1', '789', 'Sender_address', 'Receiver_id', 'Receiver_address', 'Deliver_id', GETDATE(), 'CREATED', GETDATE(), NULL, NULL, NULL, NULL, NULL, NULL);`)
    //         console.log('sql results: ')
    //         console.log(result)
    //     } catch (err) {
    //         console.log(err);
    //     }
    // })()
})


// end of database stuff

app.get('/', checkAuthenticated, (req, res) => {
    console.log('rendering index.ejs')
    res.render('index.ejs', { name: req.user.name });
})

app.get('/login', checkNotAuthenticated, (req, res) => {
    console.log('rendering login.ejs')
    res.render('login.ejs')
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}))

app.get('/register', checkNotAuthenticated, (req, res) => {
    console.log('rendering register.ejs')
    res.render('register.ejs')
})

app.post('/register', checkNotAuthenticated, async (req, res) => {
    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 10)
      users.push({
        id: Date.now().toString(),
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword
      })

        (async function () {
            try {
                console.log("sql connecting...")
                let pool = await sql.connect(sqlConfig)
                let result = await pool.request()
                    .query(`INSERT INTO [Elsa].[dbo].[Users] VALUES ('${uuidv4()}', '${req.body.name}', '${req.body.email}', '${req.body.hashedPassword}');`)
                console.log('sql results: ')
                console.log(result)
            } catch (err) {
                console.log(err);
            }
        })()
        console.log('redirecting to login.ejs')
        res.redirect('/login')
    } catch {
        console.log('rendering register.ejs')
        res.redirect('/register')
    }
})

app.get('/create', checkAuthenticated, (req, res) => {
    console.log('rendering create.ejs')
    res.render('create.ejs', { name: req.user.name })
})

app.post('/create', checkAuthenticated, (req, res) => {
    // console.log("parcelname: " + req.body.parcelname + ", username: " + req.user.name)
    //console.log(u)
    // orders.push({
    //     id: Date.now().toString(),
    //     name: req.body.parcelname
    // })

    (async function () {
        try {
            console.log("sql connecting...")
            let pool = await sql.connect(sqlConfig)
            let result = await pool.request()
                .query(`INSERT INTO [Elsa].[dbo].[Orders] VALUES ('${uuidv4()}', '${req.body.parcelname}', '${req.user.id}', 'Sender_address', 'Receiver_id', 'Receiver_address', 'Deliver_id', GETDATE(), 'CREATED', GETDATE(), NULL, NULL, NULL, NULL, NULL, NULL);`)
            console.log('sql results: ')
            console.log(result)
        } catch (err) {
            console.log(err);
        }
    })()

    console.log('rendering create_completed.ejs')
    res.render('create_completed.ejs', { name: req.user.name, parcelname: req.body.parcelname })
    // res.redirect('/create_completed.ejs', { name: 'test', parcelname: req.body.parcelname })
})  

app.get('/availability', checkAuthenticated, (req, res) => {
    let u = users.find(user => user.name === req.user.name)
    // console.log(u)

    let msg = null;

    // console.log('printing availability')
    for (let i = 0; i < u.availability.length; i++) {
        console.log(u.availability[i].availabilityStart)
    }

    console.log('rendering availability.ejs')
    res.render('availability.ejs', { name: req.user.name, u, error: msg});
})

app.post('/availability', checkAuthenticated, (req, res) => {
    // console.log('POST request, availability')
    // console.log(req.body)
    let u = users.find(user => user.name === req.user.name)

    let newStart = req.body.availabilityStart
    let newEnd = req.body.availabilityEnd

    let msg = 'Success. Availability added.'; 

    for (let i = 0; i < u.availability.length; i++) {
        let start = u.availability[i].availabilityStart 
        let end = u.availability[i].availabilityEnd

        if (newStart < end) {
            console.log('newStart < end, failed to push availability')
            msg = "Failed. Availability conflict"
            break;
        }
    }

    if (msg != 'Failed. Availability conflict')
        u.availability.push({
            availabilityStart: req.body.availabilityStart,
            availabilityEnd: req.body.availabilityEnd,  
        })
    // console.log(u)
    // constole.log(users.find(user => user.name === req.user.name))
    console.log('rendering availability.ejs')
    res.render('availability.ejs', { name: req.user.name, u, error: msg });
})

app.get('/history', checkAuthenticated, (req, res) => {
    console.log('rendering history.ejs')
    res.render('history.ejs', {orders})
})

app.get('/home', (req, res) => {
    console.log('rendering home.ejs')
    res.render('home.ejs')
})

app.delete('/logout', (req, res) => {
    req.logout()
    console.log('redirecting to login.ejs')
    res.redirect('/login')
})

//always last
app.get('*', (req, res) => {
    res.status(404)
    console.log('rendering notfound.ejs')
    res.render('notfound.ejs')
})

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }

    res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/')
    }
    next()
}

app.listen(3000);