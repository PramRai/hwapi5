var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.connect(process.env.DB);

// Movie Schema
var MovieSchema = new Schema({
    title: { type: String, required: true, index: { unique: true} },
    yearReleased: { type: String, required: true },
    genre: { type: String, required: true, enum:
            ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Thriller', 'Western']},
    actors: {
        type: [{
            actorName: { type: String, required: true },
            characterName: { type: String, required: true }
        }],
        required: true,
        validate: {
            validator: function(v) {
                return v.length >= 3;
            },
            message: 'You must have at least 3 actors'
        }
    },
    imageUrl: { type: String }
});

// Return the model
module.exports = mongoose.model('Movie', MovieSchema);