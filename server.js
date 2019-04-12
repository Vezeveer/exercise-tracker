const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || process.env.MONGO_URI, {useNewUrlParser: true} )
const db = mongoose.connection
db.on('error', function(err){
  console.log(err)
})
db.once('open', function(){
  console.log('connected to db...')
})

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// schema
const logSchema = new mongoose.Schema({
  description: {
    type: String
  },
  duration: {
    type: Number
  },
  date: {
    type: Date,
    default: Date.now
  }
})
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'username is required']
  },
  log: [logSchema],
  _id: {
    type: String,
    default: shortid.generate()
  }
})
const userModel = mongoose.model('userModel', userSchema)

// Not found middleware


// Error Handling middleware
app.use((err, req, res, next) => {
  console.log('Error hangling middleware ran...')
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

// get all users
app.get('/api/exercise/users', function(req, res){
  userModel.find({}, (err, data) => {
    if(err) console.log(err)
    let users = []
    data.map( d => {
      users.push({username: d.username, id: d._id})
    })
    res.send(users)
  })
})

// create new user
app.post('/api/exercise/new-user', function(req, res){
  const newUser = new userModel({username: req.body.username})
  newUser.save(err => {
    if(err) console.log(err)
    userModel.find({username: req.body.username}, (err, d) => {
      if(err) console.log(err)
      res.send({username: d[0].username, id: d[0]._id})
    })
  })
})

// add exercise to userid
app.post('/api/exercise/add', (req, res) => {
  if(req.body.description.length === 0){
    res.send('Please write a description in the input field.')
  } else if(req.body.duration.length === 0){
    res.send('Please type in the minutes in the input field.')
  } else{
    userModel.findOneAndUpdate({_id:req.body.userId},
                               {$push: {log:{
                                description: req.body.description,
                                duration: req.body.duration ? req.body.duration : undefined,
                                date: req.body.date ? req.body.date : new Date()
                               }}},
                               {omitUndefined:true},(err, data) => {
      if(err)console.log(err)
    })
    
    userModel.find({_id: req.body.userId}, (err, data) => {
      if(err)console.log(err)
      res.send(data)
    })
    
    /*userModel.find({_id:req.body.userId}).sort({log:{date:-1}}).limit(1).exec((err, data)=> {
      if(err)console.log(err)
      res.send({
        username:data[0].username,
        description: data[0].log[0].description,
        duration: data[0].log[0].duration,
        _id:data[0]._id,
        date: data[0].log[0].date.toDateString()
       })
    })
    */
  }
})

// retrieve exercise log
app.get('/api/exercise/log', (req, res) => {
  const from = new Date(req.query.from)
  const to = new Date(req.query.to)
  const userId = req.query.userId
  
  userModel.find({$and: [{_id: userId}, {log: {$elemMatch: {date: {$gte: from, $lte: to}}}}]}, (err, data) => {
    if(err)console.log("Error finding log: ", err)
    const arranged = data[0].log.map(d => {
      return {description: d.description, duration: d.duration, date: d.date.toDateString()}
    })
    res.send({
      _id: data[0]._id,
      username: data[0].username,
      count: data[0].log.length,
      log: arranged
    })
  })
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
