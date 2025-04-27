const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
    },
    pin: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('User', UserSchema);
