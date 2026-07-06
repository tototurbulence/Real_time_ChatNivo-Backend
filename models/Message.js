const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  type: { type: String, enum: ['text', 'system'], default: 'text' },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
