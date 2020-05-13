var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');
var jwt = require('jsonwebtoken');
var mongoose = require('mongoose');
var app = express();
var cors = require('cors');

var router = express.Router();

// module.exports = app; // for testing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());
app.use(cors());

//router middleware taht will happen on every request
router.use(function(req, res, next) {
    console.log(req.method, req.url);
    next();
});

router.route('/users/:userId')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var id = req.params.userId;
        User.findById(id, function(err, user) {
            if (err) res.send(err);
            // return that user
            res.json(user);
        });
    });

router.route('/users')
    .get(authJwtController.isAuthenticated, function (req, res) {
        User.find(function (err, users) {
            if (err) res.send(err);
            // return the users
            res.json(users);
        });
    });
router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, message: 'Please pass username and password.'});
    }
    else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;
        // save the user
        user.save(function(err) {
            if (err) {
                // duplicate entry
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists. '});
                else
                    return res.send(err);
            }
            res.json({ success: true, message: 'User created!' });
        });
    }
});

router.post('/signin', function(req, res) {
    var userNew = new User();
    userNew.name = req.body.name;
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) res.send(err);

        user.comparePassword(userNew.password, function(isMatch){
            if (isMatch) {
                var userToken = {id: user._id, username: user.username};
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, message: 'Authentication failed.'});
            }
        });
    });
});

//for the movie
router.route('/movie')
    //save movie
    .post(authJwtController.isAuthenticated, function (req, res) {
        console.log(req.body);
        var movie = new Movie();
        movie.title = req.body.title;
        movie.yearReleased = req.body.yearReleased;
        movie.genre = req.body.genre;
        movie.actors = req.body.actors;
        movie.imageUrl = req.body.imageUrl;
        movie.averageRating = req.body.averageRating;
        Movie.findOne({title: req.body.title}, function(err, found){
            if(err){
                res.json({message:"Read error \n", error: err});
            }
            else if(found){
                res.json({message:"Movie already exist"});
            }
            else if (movie.actors.length < 3){
                res.json({message:"Need at least 3 actors"});
            }
            else{
                movie.save(function (err) {
                    if(err){
                        res.json({message: "Something went wrong, check your fields\n", error: err});
                    }
                    else{
                        res.json({message: "Movie is saved to DB"});
                    }
                })
            }
        });
    })
    .get(authJwtController.isAuthenticated, function (req, res) {
        Movie.find(function (err, movie) {
            var needReview = req.query.reviews;
            if(err) res.json({message:"Read error. \n", error: err});
            if (needReview == "true"){
                Movie.aggregate([
                    {
                        $lookup:{
                            from: 'reviews',
                            localField: '_id',
                            foreignField: 'movieid',
                            as: 'Reviews'
                        }
                    },
                    {
                        $sort : { averageRating : -1} }

                ],function(err, data) {

                    if(err){
                        res.send(err);
                    }else{
                        res.json(data);
                    }
                });
            } else {
                res.json(movie);
            }
        })
    })

    //delete movie by title.
    .delete(authJwtController.isAuthenticated, function (req, res){
        Movie.findOneAndDelete({title: req.body.title}, function (err, movie) {
            if (err)
            {
                res.status(400).json({message: "Read error, something wrong", msg: err})
            }
            else if(movie == null)
            {
                res.json({msg : "The movie is not found"})
            }
            else
                res.json({msg :"Movie is deleted"})
        })
    });
router.route('/movie/:movieid')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var id = req.params.movieid;
        Movie.findById(id, function (err, movie) {
            if (err) {
                res.json({message: "Movie not found.\n"});
            }
            else {
                if (req.query.reviews == "true"){
                    Review.find(function(err, reviews) {
                        if (err) res.send(err);

                        Review.find({movietitle: movie.title}).exec(function(err, reviews) {
                            if (err) res.send(err);
                            res.json({
                                movie: movie,
                                reviews: reviews
                            });
                        });
                    });
                } else {
                    // return movie, no reviews
                    res.json(movie);
                }
            }
        })
    });

//update movie
router.route('/movie/:id')
    .put(authJwtController.isAuthenticated, function (req, res) {
        var conditions = {_id: req.params.id};
        Movie.findOne({title: req.body.title}, function(err, found) {
            if (err) {
                res.json({message: "Read error \n", error: err});
            }
                // if (found) {
            //   res.json({message: "Movie already exist"});
            else {
                Movie.updateOne(conditions, req.body)
                    .then(mov => {
                        if (!mov) {
                            return res.status(404).end();
                        }
                        return res.status(200).json({msg: "Movie is updated"})
                    })
                    .catch(err => next(err))
            }
        })
    });

router.route('/review')
    .post(authJwtController.isAuthenticated, function(req, res){
        let usertoken = req.headers.authorization;
        let token = usertoken.split(' ');
        let decoded = jwt.verify(token[1], process.env.SECRET_KEY);
        let id = req.body.movieid;
        Movie.findById(id, function (err, something){
            if (err) {
                res.json({message: "Error Movie not exist."});
            }
            else if (something) {
                var review = new Review();
                review.name = decoded.username;
                review.review = req.body.review;
                review.rating = req.body.rating;
                review.movieid = req.body.movieid;

                review.save(function (err) {
                    if (err) {
                        res.json({message: "Review has not saved because you missing required fields!"});
                    } else {

                        Review.find({movieid: req.body.movieid}, function (err, allReviews) {
                            if (err) {
                                res.status(400).json({message: "It's broken!"});
                            } else {
                                let avg = 0;

                                console.log(allReviews);
                                allReviews.forEach(function (review) {
                                    avg += review.rating;
                                    console.log(review);
                                });
                                avg = avg / allReviews.length;


                                Movie.update(
                                    {_id: id},
                                    {$set: {averageRating: avg}}, function (err, doc) {
                                        if (err) {
                                            res.json({error: err});
                                        } else if (doc != null) {
                                            res.json({message: "Review 🚀 saved to Mongo DB"});
                                        }
                                    });

                            }
                        })
                    }
                })
            }else {
                res.json({failure: "Movie not found."});
            }
        })
    });

//All other routs and methods
router.all('*', function(req, res) {
    res.json({
        error: 'HTTP method is not supported.‍'
    });
});

app.use('/', router);
app.listen(process.env.PORT || 8080);
