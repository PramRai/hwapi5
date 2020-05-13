var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.connect(process.env.DB);

// Review Schema
var ReviewSchema = new Schema({
    name: { type: String, required: true },
    movieid: { type: String, required: true },
    review: { type: String, required: true },
    rating: { type: Number, enum:[1,2,3,4,5]}
});

// Return the model
module.exports = mongoose.model('Review', ReviewSchema);