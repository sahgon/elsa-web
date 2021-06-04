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

const users = [{ id: 1, name: 'Konstantinos', email: 'k@k', password: '0', availability: [] },
{ id: 2, name: 'Alexandros', email: 'a@a', password: '1', availability: [] },
{ id: 3, name: 'Rafael', email: 'r@r', password: '2', availability: [] }]
const orders = []
const toDeliver = []
const toReceive = []

// app.use(express.cookieParser('secret'));
// app.use(express.cookieSession());
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
const { create } = require('domain');
const { response } = require('express');

var sqlConfig = {
    user: 'elsa',
    password: 'elsa',
    server: `79.131.185.146`,  
    database: 'Elsa',
    trustServerCertificate: true,
};

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


//δημιουργία παραγγελίας
app.post('/create', checkAuthenticated, (req, res) => {
    // console.log("parcelname: " + req.body.parcelname + ", username: " + req.user.name)
    //console.log(u)
    // orders.push({
    //     id: Date.now().toString(),
    //     name: req.body.parcelname
    // })

    (async function () {
        try {
            let new_id = uuidv4()
            console.log("sql connecting...")
            let pool = await sql.connect(sqlConfig)
            let result = await pool.request()
                .query(`INSERT INTO [Elsa].[dbo].[Orders] VALUES ('${new_id}', '${req.body.parcelname}', '${req.user.id}', '${req.body.sendersAddress}', (SELECT TOP 1 id FROM [Elsa].[dbo].[Users] WHERE email = '${req.body.receiversEmail}'), '${req.body.receiversAddress}', NULL, GETDATE(), 'CREATED', GETDATE(), '0', '0');`)
            console.log('sql results: ')
            console.log(result)
            console.log('rendering create_completed.ejs')
            res.render('create_completed.ejs', { name: req.user.name, name: req.body.parcelname, id: new_id, msg:'Success' })
        } catch (err) {
            console.log(err);
            console.log('FAILURE')
            res.render('create_completed.ejs', { name: req.user.name, parcelname: req.body.parcelname, msg:'Failed' })
        }
    })()
    // res.redirect('/create_completed.ejs', { name: 'test', parcelname: req.body.parcelname })
}) 

app.get('/availability', checkAuthenticated, (req, res) => {
    let db_response = [];
    (async function () {
        try {
            console.log("sql connecting...")
            let pool = await sql.connect(sqlConfig)
            db_response = await pool.request()
                .query(`SELECT
                        [start_time]
                        ,[end_time]
                        FROM [Elsa].[dbo].[Availability] WHERE [user_id] = '${req.user.id}' ORDER BY [start_time]`)
            
            db_response = db_response.recordset
            console.log(db_response)

            res.render('availability.ejs', { name:req.user.name, response:'', db_response:db_response, db_conn_status:'1', post_req_db_conn_status: '', post_req_response: ''})
        } catch (err) {
            console.log(err);
            console.log('FAILURE')
            console.log('rendering getjob.ejs')
            res.render('availability.ejs', { name:req.user.name, response:'Failed to connect with the database', db_response:[], db_conn_status:'0', post_req_db_conn_status: '', post_req_response: ''})
        }
    })();
})

app.post('/availability',checkAuthenticated, (req, res) => {
    let name = req.user.name
    let response = ''

    let newStart = req.body.availabilityStart + ':00.000Z'
    let newEnd = req.body.availabilityEnd + ':00.000Z'

    let current_date = new Date().toISOString().slice(0, 16);

    console.log("current_date: " + current_date + ", new start: " + newStart + ", new end: " + newEnd)


        let db_response = '';
        (async function () {
            try {
                console.log("sql connecting...")
                let pool = await sql.connect(sqlConfig)
                db_response = await pool.request()
                    .query(`SELECT
                            [start_time]
                            ,[end_time]
                            FROM [Elsa].[dbo].[Availability] WHERE [user_id] = '${req.user.id}' ORDER BY [start_time] ASC;`)
                
                db_response = db_response.recordset
                console.log(db_response)

                if (!(current_date < newStart && current_date < newEnd)) {
                    response = 'Fail. Dates must be in future.'
                    console.log('Dates must be in future.')
                    res.render('availability.ejs', {name:req.user.name, response:response, db_response:db_response, db_conn_status:'1'})
                    return
                }

                response = 'Όλα φαίνονται καλά. Έγινε καταχώρηση.'
    
                for (let i = 0; i < db_response.length; i++) {
                    console.log('newStart: ' + newStart + ', newEnd: ' + newEnd + ', db start_time: ' + ((new Date(db_response[i].start_time)).toISOString()) + ', db end_time: ' + ((new Date(db_response[i].end_time)).toISOString()))

                    console.log(current_date < newEnd)
                    if (newStart < ((new Date(db_response[i].end_time)).toISOString()) && newStart > ((new Date(db_response[i].start_time)).toISOString())) {
                        response = 'Αποτυχία. Η ημ/νία έναρξης δεν συμβαδίζει με τις ήδη καταχωρημένες ημ/νίες.'
                        console.log(response)
                        res.render('availability.ejs', { name:req.user.name, response:response, db_response:db_response, db_conn_status:'1'})
                        return
                    } else if (newStart < ((new Date(db_response[i].start_time)).toISOString()) && newEnd > ((new Date(db_response[i].end_time)).toISOString())) {
                        response = 'Αποτυχία. Η ημ/νία λήξης δεν συμβαδίζει με τις ήδη καταχωρημένες ημ/νίες.'
                        console.log(response)
                        res.render('availability.ejs', { name:req.user.name, response:response, db_response:db_response, db_conn_status:'1'})
                        return
                    }
                }

                let db_response2 = ''
                console.log('inserting availability')
                db_response2 = await pool.request()
                    .query(`INSERT INTO [Elsa].[dbo].[Availability]
                    values('${uuidv4()}', '${req.user.id}', '${newStart}', '${newEnd}');`)

                console.log('done inserting availability')
                // res.render('availability.ejs', { name:req.user.name, response:response, db_response:db_response, db_conn_status:'1'})
                res.redirect('/availability')
            } catch (err) {
                console.log(err);
                console.log('FAILURE')
                console.log('rendering getjob.ejs')
                res.render('availability.ejs', { name:req.user.name, response: 'Αποτυχία επικοινωνίας με την βάση δεδομένων μας.', db_response:[], db_conn_status:'0'})
            }
        })();
})

app.get('/history', checkAuthenticated, (req, res) => {

    //get data for orders created
    let created = '', received = '', delivered = '';
    (async function () {
        try {
            console.log("sql connecting...")
            let pool = await sql.connect(sqlConfig)
            created = await pool.request()
                .query(`SELECT o.id as id, o.name as name, date_created, current_status, s.name as sender_name, o.sender_address as sender_address, r.name as receiver_name, o.receiver_address as receiver_address, d.name as deliver_name
                FROM [Elsa].[dbo].[Orders] o
                INNER JOIN [Elsa].[dbo].[Users] s on s.id = o.sender_id
                INNER JOIN [Elsa].[dbo].[Users] r on r.id = o.receiver_id
                INNER JOIN [Elsa].[dbo].[Users] d on d.id = o.deliver_id
                WHERE o.sender_id = '${req.user.id}';`)
            
            received = await pool.request()
                .query(`SELECT o.id as id, o.name as name, date_created, current_status, s.name as sender_name, o.sender_address as sender_address, r.name as receiver_name, o.receiver_address as receiver_address, d.name as deliver_name
                FROM [Elsa].[dbo].[Orders] o
                INNER JOIN [Elsa].[dbo].[Users] s on s.id = o.sender_id
                INNER JOIN [Elsa].[dbo].[Users] r on r.id = o.receiver_id
                INNER JOIN [Elsa].[dbo].[Users] d on d.id = o.deliver_id
                WHERE o.receiver_id = '${req.user.id}';`)

            delivered = await pool.request()
                .query(`SELECT o.id as id, o.name as name, date_created, current_status, s.name as sender_name, o.sender_address as sender_address, r.name as receiver_name, o.receiver_address as receiver_address, d.name as deliver_name
                FROM [Elsa].[dbo].[Orders] o
                INNER JOIN [Elsa].[dbo].[Users] s on s.id = o.sender_id
                INNER JOIN [Elsa].[dbo].[Users] r on r.id = o.receiver_id
                INNER JOIN [Elsa].[dbo].[Users] d on d.id = o.deliver_id
                WHERE o.deliver_id = '${req.user.id}';`)
            console.log('sql results: ')
            created = created.recordset
            received = received.recordset
            delivered = delivered.recordset

            console.log('printing results')
            console.log(created)
            console.log(received)
            console.log(delivered)
            console.log('done printing results')
            res.render('history.ejs', { created: created, received: received, delivered: delivered, db_conn_status:'1'})
        } catch (err) {
            console.log(err);
            console.log('FAILURE')
            res.render('history.ejs', { created: 'error', received: 'error', delivered: 'error', db_conn_status:'0'  })
        }
        // res.render('history.ejs', { created: created, received: received, delivered: delivered  })
    })();
})

app.get('/job', checkAuthenticated, (req, res) => {
    console.log('rendering job.ejs')
    res.render('job.ejs')
})

app.get('/getjob', checkAuthenticated, (req, res) => {
    let response = ''
    let db_response = '';
    let db_response2 = '';
    (async function () {
        try {
            console.log("sql connecting...")
            let pool = await sql.connect(sqlConfig)
            db_response = await pool.request()
                .query(`SELECT TOP 1 o.[id] as id, o.[name] as name, o.[current_status] as current_status, o.[date_created] as date_created, u1.[name] as sender_name, o.[sender_address] as sender_address, u2.[name] as receiver_name, o.[receiver_address] as receiver_address
                FROM [Elsa].[dbo].[Orders] o
                INNER JOIN Availability A ON (o.[date_created] > a.[start_time] AND o.[date_created] < a.[end_time])
                INNER JOIN [Elsa].[dbo].[Users] u1 ON o.[sender_id] = u1.[id]
                INNER JOIN [Elsa].[dbo].[Users] u2 ON o.[receiver_id] = u2.[id]
                WHERE o.[current_status] = 'CREATED' AND
                a.[user_id] = '${req.user.id}' AND o.[deliver_id] IS NULL AND o.[sender_id] != '${req.user.id}' AND o.[receiver_id] != '${req.user.id}';`)
            
            console.log('sql results: ')
            db_response = db_response.recordset
            console.log(db_response)

            console.log('done printing results')
            if (db_response.length == 0) {
                console.log(response)
                response = 'Δυστυχώς, δεν υπάρχει κάτι αυτή τη στιγμή.'
                db_response = []

                console.log('rendering getjob.ejs')
                res.render('result_job.ejs', { response: response, db_response: db_response, db_conn_status:'1' })
            } else {
                response = 'Βρήκαμε κάτι :)'
                console.log(response)

                db_response2 = await pool.request()
                .query(`UPDATE [Elsa].[dbo].[Orders]
                SET deliver_id = '${req.user.id}', current_status = 'ASSIGNED', status_last = GETDATE()
                WHERE id = '${db_response[0].id}';`)

                console.log('rendering getjob.ejs')
                res.render('result_job.ejs', { response: response, db_response: db_response, db_conn_status:'1' })
                return

            }
        } catch (err) {
            console.log(err);
            console.log('FAILURE')
            console.log('rendering getjob.ejs')
            res.render('result_job.ejs', { response: 'Αποτυχία', db_response:[], db_conn_status:'0' })
        }
    })();
})

app.get('/manage_deliver', checkAuthenticated, (req, res) => {
    let response = ''
    let db_response = '';
    (async function () {
        try {
            console.log("sql connecting...")
            let pool = await sql.connect(sqlConfig)
            db_response = await pool.request()
                .query(`SELECT o.[id] as id
                ,o.[name] as name
                ,u1.[name] as sender_name
                ,o.[sender_address] as sender_address
                ,u2.[name] as receiver_name
                ,o.[receiver_address] as receiver_address
                ,ISNULL((SELECT name FROM Users WHERE id = O.deliver_id), '-') AS deliver_name
                ,o.[date_created] as date_created
                ,o.[current_status] as current_status
                FROM [Elsa].[dbo].[Orders] o
                INNER JOIN [Elsa].[dbo].[Users] u1 ON o.[sender_id] = u1.[id]
                INNER JOIN [Elsa].[dbo].[Users] u2 ON o.[receiver_id] = u2.[id]
                WHERE [deliver_id] = '${req.user.id}' AND [current_status] NOT IN ('DELIVERED','CANCELED');`)
            
            console.log('sql results: ')
            db_response = db_response.recordset
            console.log(db_response)
            console.log('done printing results')
            if (db_response.length == 0) {
                console.log(response)
                response = 'Δεν υπάρχουν δεδομένα προς εμφάνιση.'
                db_response = []

                console.log('rendering getjob.ejs')
                res.render('manage_deliver.ejs', { response: response, db_response: db_response, db_conn_status:'1' })
            } else {
                response = 'Υπάρχουν δεδομένα προς εμφάνιση.'
                console.log(response)

                console.log('rendering getjob.ejs')
                res.render('manage_deliver.ejs', { response: response, db_response: db_response, db_conn_status:'1' })
            }
        } catch (err) {
            console.log(err);
            console.log('FAILURE')
            console.log('rendering getjob.ejs')
            res.render('manage_deliver.ejs', { response: 'Αποτυχία', db_response:[], db_conn_status:'0' })
        }
    })();
})

app.post('/set_deliver', checkAuthenticated, (req, res) => {
    
    let id = req.body.id
    let new_status = req.body.new_status
    
    let col = ''
    if (new_status == '')

    console.log('id: ' + id + ', new status: ' + new_status)
    let response = ''
    let db_response = '';
    (async function () {
        try {
            console.log("sql connecting...")
            let pool = await sql.connect(sqlConfig)
            db_response = await pool.request()
                .query(`UPDATE [Elsa].[dbo].[Orders]
                SET current_status = '${new_status}', status_last = GETDATE()
                WHERE id = '${id}' AND deliver_id = '${req.user.id}';`)
            
            console.log('sql results: ')
            db_response = db_response.recordset
            console.log(db_response)
            console.log('done printing results')
            if (db_response.length == 0) {
                console.log(response)
                response = 'Δεν υπάρχουν δεδομένα προς εμφάνιση.'
                db_response = []

                console.log('rendering getjob.ejs')
                res.redirect('manage_deliver.ejs')
            } else {
                response = 'Υπάρχουν δεδομένα προς εμφάνιση.'
                console.log(response)

                console.log('rendering getjob.ejs')
                res.redirect('manage_deliver.ejs')
            }
        } catch (err) {
            console.log(err);
            console.log('FAILURE')
            console.log('rendering getjob.ejs')
            res.redirect('manage_deliver.ejs')
        }
    })();
    res.redirect('/manage_deliver')
})

app.get('/manage_receiver', checkAuthenticated, (req, res) => {
    let response = ''
    let db_response = '';
    (async function () {
        try {
            console.log("sql connecting...")
            let pool = await sql.connect(sqlConfig)
            db_response = await pool.request()
                .query(`SELECT o.[id] as id
                ,o.[name] as name
                ,u1.[name] as sender_name
                ,o.[sender_address] as sender_address
                ,u2.[name] as receiver_name
                ,o.[receiver_address] as receiver_address
                ,ISNULL((SELECT name FROM Users WHERE id = O.deliver_id), '-') AS deliver_name
                ,o.[date_created] as date_created
                ,o.[current_status] as current_status
                FROM [Elsa].[dbo].[Orders] o
                INNER JOIN [Elsa].[dbo].[Users] u1 ON o.[sender_id] = u1.[id]
                INNER JOIN [Elsa].[dbo].[Users] u2 ON o.[receiver_id] = u2.[id]
                WHERE [receiver_id] = '${req.user.id}' AND [current_status] NOT IN ('CANCELED');`)
            
            console.log('sql results: ')
            db_response = db_response.recordset
            console.log(db_response)
            console.log('done printing results')
            if (db_response.length == 0) {
                console.log(response)
                response = 'Δεν υπάρχουν δεδομένα προς εμφάνιση.'
                db_response = []

                console.log('rendering manage_receiver.ejs')
                res.render('manage_receiver.ejs', { response: response, db_response: db_response, db_conn_status:'1' })
            } else {
                response = 'Υπάρχουν δεδομένα προς εμφάνιση.'
                console.log(response)

                console.log('rendering manage_receiver.ejs')
                res.render('manage_receiver.ejs', { response: response, db_response: db_response, db_conn_status:'1' })
            }
        } catch (err) {
            console.log(err);
            console.log('FAILURE')
            console.log('rendering manage_receiver.ejs')
            res.render('manage_receiver.ejs', { response: 'Αποτυχία', db_response:[], db_conn_status:'0' })
        }
    })();
})

app.post('/set_receiver', checkAuthenticated, (req, res) => {
    
    let id = req.body.id
    let new_status = req.body.new_status
    
    let col = ''
    if (new_status == '')

    console.log('id: ' + id + ', new status: ' + new_status)
    let response = ''
    let db_response = '';
    (async function () {
        try {
            console.log("sql connecting...")
            let pool = await sql.connect(sqlConfig)
            db_response = await pool.request()
                .query(`UPDATE [Elsa].[dbo].[Orders]
                SET current_status = '${new_status}'
                WHERE id = '${id}' AND receiver_id = '${req.user.id}';`)
            
            console.log('sql results: ')
            db_response = db_response.recordset
            console.log(db_response)
            console.log('done printing results')
            if (db_response.length == 0) {
                console.log(response)
                response = 'Δεν υπάρχουν δεδομένα προς εμφάνιση.'
                db_response = []

                console.log('rendering manage_receiver.ejs')
                res.redirect('manage_receiver.ejs')
            } else {
                response = 'Υπάρχουν δεδομένα προς εμφάνιση.'
                console.log(response)

                console.log('rendering manage_receiver.ejs')
                res.redirect('manage_receiver.ejs')
            }
        } catch (err) {
            console.log(err);
            console.log('FAILURE')
            console.log('rendering manage_receiver.ejs')
            res.redirect('manage_receiver.ejs')
        }
    })();
    res.redirect('/manage_receiver')
})

app.get('/manage_sender', checkAuthenticated, (req, res) => {
    console.log('/manage_sender')
    let response = ''
    let db_response = '';
    (async function () {
        try {
            console.log("sql connecting...")
            let pool = await sql.connect(sqlConfig)
            db_response = await pool.request()
                .query(`SELECT o.[id] as id
                ,o.[name] as name
                ,u1.[name] as sender_name
                ,o.[sender_address] as sender_address
                ,u2.[name] as receiver_name
                ,o.[receiver_address] as receiver_address
                ,ISNULL((SELECT name FROM Users WHERE id = O.deliver_id), '-') AS deliver_name
                ,o.[date_created] as date_created
                ,o.[current_status] as current_status
                FROM [Elsa].[dbo].[Orders] o
                INNER JOIN [Elsa].[dbo].[Users] u1 ON o.[sender_id] = u1.[id]
                INNER JOIN [Elsa].[dbo].[Users] u2 ON o.[receiver_id] = u2.[id]
                WHERE [sender_id] = '${req.user.id}' AND [current_status] NOT IN ('CANCELED', 'PICKUP', 'ASSIGNED', 'ON TRANSIT', 'DELIVERED','READY TO DISPATCH ');`)
            
            console.log('sql results: ')
            db_response = db_response.recordset
            console.log(db_response)
            console.log('done printing results')
            if (db_response.length == 0) {
                console.log(response)
                response = 'Δεν υπάρχουν δεδομένα προς εμφάνιση.'
                db_response = []

                console.log('rendering manage_sender.ejs')
                res.render('manage_sender.ejs', { response: response, db_response: db_response, db_conn_status:'1' })
            } else {
                response = 'Υπάρχουν δεδομένα προς εμφάνιση.'
                console.log(response)

                console.log('rendering manage_sender.ejs')
                res.render('manage_sender.ejs', { response: response, db_response: db_response, db_conn_status:'1' })
            }
        } catch (err) {
            console.log(err);
            console.log('FAILURE')
            console.log('rendering manage_sender.ejs')
            res.render('manage_sender.ejs', { response: 'Αποτυχία', db_response:[], db_conn_status:'0' })
        }
    })();
})

app.post('/set_sender', checkAuthenticated, (req, res) => {
    console.log('/set_sender')
    let id = req.body.id
    let new_status = req.body.new_status
    
    let col = ''
    console.log('id: ' + id + ', new status: ' + new_status)
    let response = ''
    let db_response = '';
    (async function () {
        try {
            console.log("sql connecting...")
            let pool = await sql.connect(sqlConfig)
            db_response = await pool.request()
                .query(`UPDATE [Elsa].[dbo].[Orders]
                SET current_status = '${new_status}', status_last = GETDATE()
                WHERE id = '${id}' AND sender_id = '${req.user.id}';
                `)


            
            // console.log('sql results: ')
            // db_response = db_response.recordset
            // console.log(db_response)
            // console.log('done printing results')
            // if (db_response.length == 0) {
            //     console.log(response)
            //     response = 'Δεν υπάρχουν δεδομένα προς εμφάνιση.'
            //     db_response = []

            //     console.log('rendering manage_sender.ejs')
            //     res.redirect('manage_sender.ejs')
            // } else {
            //     response = 'Υπάρχουν δεδομένα προς εμφάνιση.'
            //     console.log(response)

            //     console.log('rendering manage_sender.ejs')
                res.redirect('manage_sender.ejs')
            // }
        } catch (err) {
            console.log(err);
            console.log('FAILURE')
            console.log('rendering manage_sender.ejs')
            res.redirect('manage_sender.ejs')
        }
    })();
    res.redirect('/manage_sender')
})

app.get('/tracking/:id', (req, res) => {
    console.log(`/tracking/${req.params.id}`)
    let response = ''
    let db_response = '';
    (async function () {
        try {
            console.log("sql connecting...")
            let pool = await sql.connect(sqlConfig)
            db_response = await pool.request()
                .query(`SELECT [id], [status], [datetime], [comment], (SELECT TOP 1 [name] FROM [Elsa].[dbo].[Orders] WHERE [id]='${req.params.id}') AS name
                FROM [Elsa].[dbo].[Tracking] WHERE [id] = '${req.params.id}';`)
            
            console.log('sql results: ')
            db_response = db_response.recordset
            console.log(db_response)
            console.log('done printing results')

            if (db_response.length == 0) {
                console.log(response)
                response = 'Δεν υπάρχουν δεδομένα προς εμφάνιση.'
                db_response = []

                console.log('rendering tracking.ejs')
                res.render('tracking.ejs', { response: response, db_response: db_response, db_conn_status:'1' })
            } else {
                response = 'Υπάρχουν δεδομένα προς εμφάνιση.'
                console.log(response)

                console.log('rendering tracking.ejs')
                res.render('tracking.ejs', { response: response, db_response: db_response, db_conn_status:'1' })
            }
        } catch (err) {
            console.log(err);
            console.log('FAILURE')
            console.log('rendering tracking.ejs')
            res.render('tracking.ejs', { response: 'Αποτυχία', db_response:[], db_conn_status:'0' })
        }
    })();
})

app.get('/rate_deliver', checkAuthenticated, (req, res) => {
    res.render('rate_deliver.ejs')
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

app.listen(process.env.PORT || 3000);