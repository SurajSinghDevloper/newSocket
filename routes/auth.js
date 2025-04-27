const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register Host
router.post('/register', async (req, res) => {
    const { code, pin } = req.body;
    try {
        let user = new User({ code, pin });
        await user.save();
        res.json({ success: true, message: 'Host Registered Successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Authenticate Connection
router.post('/connect', async (req, res) => {
    const { code, pin } = req.body;
    try {
        const user = await User.findOne({ code, pin });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid Credentials' });
        }
        res.json({ success: true, message: 'Connected' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
