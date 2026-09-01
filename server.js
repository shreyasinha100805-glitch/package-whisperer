const express = require('express');
const app = express();
app.use(express.json());

app.get('/link', (req, res) => res.send('Account link placeholder'));
app.get('/home', (req, res) => res.send('App homepage placeholder'));
app.post('/token', (req, res) => res.json({ status: 'placeholder' }));
app.post('/webhook', (req, res) => res.sendStatus(200));

app.listen(3000, () => console.log('Running on port 3000'));