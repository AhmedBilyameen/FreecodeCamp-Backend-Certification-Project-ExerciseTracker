const express = require('express')
const mongoose = require('mongoose');
const app = express()
const cors = require('cors')
require('dotenv').config()
const bodyParser = require('body-parser');

const User = require('./model/user.model');
const Exercise = require('./model/exercise.model');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.json());

const MONGO_URI = process.env.MONGODB_URL

mongoose.connect(MONGO_URI)
  .then(() => console.log('Mongo connected'))
  .catch(err => console.error('Mongo connection error:', err));

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Create a new user
app.post('/api/users', async (req, res) => {
  try {
    const username = req.body.username?.trim();
    if (!username) return res.status(400).json({ error: 'username required' });

    const user = new User({ username });
    await user.save();

    // FCC expects { username, _id }
    res.json({ username: user.username, _id: user._id.toString() });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id').exec();
    // send array of { username, _id }
    res.json(users.map(u => ({ username: u.username, _id: u._id.toString() })));
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

//Excercise API

// Add exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const { description, duration, date } = req.body;
    const userId = req.params._id;

    // Validate user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Use provided date or default to today
    const exerciseDate = date ? new Date(date) : new Date();
    if (exerciseDate.toString() === 'Invalid Date') {
      return res.status(400).json({ error: 'Invalid date' });
    }

    const exercise = new Exercise({
      userId,
      description,
      duration: Number(duration),
      date: exerciseDate
    });

    await exercise.save();

    // FCC expects response with username
    res.json({
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString(), // "Mon Jan 01 1990"
      _id: user._id.toString()
    });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

//LOGs Route
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const { from, to, limit } = req.query;
    const userId = req.params._id;

    // 1) Find user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 2) Parse dates and validate
    let fromDate = from ? new Date(from) : null;
    let toDate   = to   ? new Date(to)   : null;
    if (fromDate && isNaN(fromDate.getTime())) fromDate = null;
    if (toDate   && isNaN(toDate.getTime()))   toDate   = null;

    // 3) Build query object
    let query = { userId };
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate)   query.date.$lte = toDate;
    }

    // 4) Execute query with optional limit
    let exercisesQuery = Exercise.find(query).select('description duration date').sort({ date: 1 });
    if (limit && !isNaN(Number(limit))) exercisesQuery = exercisesQuery.limit(Number(limit));
    const exercises = await exercisesQuery.exec();

    // 5) Format log
    const log = exercises.map(e => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString()
    }));

    // 6) Respond
    res.json({
      username: user.username,
      _id: user._id.toString(),
      count: exercises.length,
      log
    });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
