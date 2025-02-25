const express = require('express');
const User = require('../controllers/user');


var customerRoute = (app) => {

    // testing app route
    app.get("/v1/user/getExample", User.getExample);

    // Sign-Up Routes
    app.post("/v1/user/signUp", User.signup);
    app.post("/v1/user/login", User.login);
    app.post("/v1/user/getByEmailOrMobile", User.getUserByEmailOrMobile);

    // Otp Routes
    app.post("/v1/user/createOtp", User.createOtp);
    app.post("/v1/user/verifyOtp", User.verifyOtp);
    app.post("/v1/user/resendOtp", User.resendOtp);

    // user language routes
    app.get("/v1/user/languages", User.getLanguages);
    app.post("/v1/user/setLanguage", User.setUserLanguage);

    // Forgot Password and Update Password Routes
    app.post("/v1/user/forgotPassword", User.forgotPassword);
    app.post("/v1/user/verifyForgotPasswordOtp", User.verifyForgotPasswordOtp);
    app.post("/v1/user/changePassword", User.changePassword);// forgot password change password
    app.post("/v1/user/updatePassword", User.updatePassword);// update user password

    app.get("/v1/post/post-style", User.getAllPostStyles);
    app.get("/v1/post/post-categories", User.getAllCategories);
    app.get('/v1/post/allPosts', User.getAllPosts);
    app.post('/v1/post/postByStyle', User.getPostsByStyle);
    app.post('/v1/post/saved', User.getSavedPosts);
    app.post("/v1/post/images/rating", User.getPostImagesByRating);
    app.get("/v1/post/trending", User.getTrendingPosts);
    app.post("/v1/post/new", User.getNewPosts);
    app.post("/v1/post/following", User.getPostsByFollowingUsers);
    app.post("/v1/post/expiring", User.getExpiringPosts);
    app.post("/v1/post/category", User.getPostsByCategory);
    app.post("/v1/user/post/createPost", User.createPost);
    app.post("/v1/post/delete", User.deletePost);

    app.post('/v1/user/profile', User.getUserProfile);
    app.post("/v1/user/otherUserProfile", User.getOtherUserProfile);
    app.post('/v1/user/edit-profile', User.updateUserProfile);
    app.post("/v1/user/logout", User.logout);
    app.post("/v1/user/deleteAccount", User.deleteAccount);

    app.post("/v1/app/blogs", User.createBlog);
    app.post("/v1/app/contactUs", User.createContactUsEntry);


};

module.exports = customerRoute;

