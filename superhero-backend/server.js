require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mysql = require('mysql2'); // Require mysql2 package
const path = require('path'); // To serve static files
const url = require('url'); // To parse the database URL

const app = express();
const PORT = process.env.PORT || 3001; // Use Heroku's port or default to 3001

// Use CORS to allow cross-origin requests
const corsOptions = {
  origin: '*', // Allow any origin for testing, change to your frontend URL in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable CORS pre-flight for all routes

app.use(express.json()); // Parse incoming JSON requests

// Parse the JawsDB connection URL
const dbUrl = process.env.JAWSDB_URL || 'your-default-mysql-url';
const dbParams = new url.URL(dbUrl);

// Set up MySQL connection using JawsDB
const db = mysql.createConnection({
  host: dbParams.hostname,
  user: dbParams.username,
  password: dbParams.password,
  database: dbParams.pathname.replace('/', ''), // Extract the database name
  port: dbParams.port || 3306, // Use port from URL or default to 3306
});

// Connect to the MySQL database
db.connect((err) => {
  if (err) {
    console.error('Failed to connect to MySQL:', err);
    return;
  }
  console.log('Connected to JawsDB MySQL database.');
});

// Serve static files from the frontend's build folder
app.use(express.static(path.join(__dirname, 'superhero-frontend', 'build')));

// Cache for heroes
let cachedHeroes = [];

// Function to fetch heroes by letter and add them to the cache
const fetchHeroesByLetter = async (letter) => {
  try {
    const apiKey = process.env.SUPERHERO_API_KEY; // Load API key from .env file
    const allHeroesUrl = `https://superheroapi.com/api/${apiKey}/search/${letter}`; // Use the API key in the request URL
    console.log(`Fetching heroes starting with letter: ${letter}`);
    const response = await axios.get(allHeroesUrl);

    if (response.data.results && response.data.results.length > 0) {
      response.data.results.forEach((hero) => {
        if (!cachedHeroes.some(cachedHero => cachedHero.id === hero.id)) {
          cachedHeroes.push(hero); // Only add unique heroes to the cache
        }
      });
      console.log(`Cached heroes after fetching letter ${letter}: ${cachedHeroes.length} heroes.`);
    }
  } catch (error) {
    console.error(`Error fetching heroes for letter ${letter}:`, error.response?.data || error.message);
  }
};

// Function to populate cache with heroes
const initializeHeroCache = async () => {
  const lettersToFetch = 'abcdefghijklmnopqrstuvwxyz'.split(''); // Fetch heroes for all letters
  for (const letter of lettersToFetch) {
    await fetchHeroesByLetter(letter);
  }
};

// API endpoint to fetch all heroes
app.get('/api/heroes', async (req, res) => {
  try {
    const { alignment } = req.query;

    // If cache is empty, initialize it by fetching heroes
    if (cachedHeroes.length === 0) {
      console.log('Cache is empty, initializing hero cache...');
      await initializeHeroCache();
    }

    // Filter heroes by alignment if specified
    const filteredHeroes = alignment
      ? cachedHeroes.filter((hero) => hero.biography.alignment && hero.biography.alignment.toLowerCase() === alignment.toLowerCase())
      : cachedHeroes;

    res.json(filteredHeroes);
  } catch (error) {
    console.error('Error fetching heroes:', error.message);
    res.status(500).json({ message: 'Error fetching heroes.' });
  }
});

// New API endpoint to search superheroes by name
app.get('/api/superhero', async (req, res) => {
  const heroName = req.query.name?.toLowerCase(); // Normalize the search term to lowercase
  if (!heroName) {
    return res.status(400).json({ message: 'Please provide a superhero name.' });
  }

  try {
    // Filter the cached heroes based on the name, case-insensitively
    const matchingHeroes = cachedHeroes.filter(hero =>
      hero.name.toLowerCase().includes(heroName)
    );

    if (matchingHeroes.length > 0) {
      res.json(matchingHeroes); // Return matching heroes from the cache
    } else {
      res.status(404).json({ message: `No superhero found with name: ${heroName}` });
    }
  } catch (error) {
    console.error('Error fetching superhero by name:', error.message);
    res.status(500).json({ message: 'Error fetching superhero data.' });
  }
});

// API endpoint to fetch superhero by ID
app.get('/api/superhero/:id', async (req, res) => {
  const heroId = req.params.id;
  try {
    const apiKey = process.env.SUPERHERO_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'API key is missing' });
    }

    const heroUrl = `https://superheroapi.com/api/${apiKey}/${heroId}`;
    const response = await axios.get(heroUrl);

    if (response.data && response.data.response === 'success') {
      res.json(response.data); // Send back the hero details in JSON format
    } else {
      res.status(404).json({ message: `No superhero found with ID: ${heroId}` });
    }
  } catch (error) {
    console.error('Error fetching superhero details:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error fetching superhero data.' });
  }
});

// Catch-all route to serve the frontend for any unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'superhero-frontend', 'build', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});