const common = require('../../../../utilities/common');
const responseCode = require('../../../../utilities/response-error-code');
const userModel = require('../modals/user-modal');

class User {

    getExample(req, res) {
        userModel.getExampleData((err, data) => {
            if (err) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: "Failed to fetch example data",
                    data: null
                }, 500);
            }

            return common.response(res, {
                code: responseCode.SUCCESS,
                message: "Example data fetched successfully",
                data: data
            });
        });
    }


    // =======================
    // ✅ Signup API
    // =======================
    signup(req, res) {
        const { username, email, password, mobile, fullname, dob, login_type, social_id, verifyWith, deviceInfo } = req.body;

        // id, username, fullname, email, password, profile_image, bio, mobile, dob, login_type, social_id, gender, total_followers, total_following, total_Retreate, total_myRatings, total_stylMouCoins, country_id, is_active, is_deleted, created_at, deleted_at, updated_at

        // ✅ Validate required fields
        if (!username || !email || !password || !mobile || !verifyWith || !login_type || !fullname || !dob) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "Username, email, password, mobile, fullname, dob, login_type and verifyWith are required.",
                data: null
            }, 400);
        }

        // ✅ Validate social_id for social logins
        if ((login_type === 'google' || login_type === 'facebook') && !social_id) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "social_id is required for Google or Facebook login.",
                data: null
            }, 400);
        }

        const hashedPassword = common.hashPassword(password);

        // ✅ Check if user already exists (by email or mobile)
        userModel.getUserByEmailOrMobile(email, mobile, (err, existingUser) => {
            if (err) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: "Error checking existing user.",
                    data: null
                }, 500);
            }

            if (existingUser && existingUser.data) {
                const existingData = existingUser.data;
                let message = "";

                if (existingData.email === email && existingData.mobile === mobile) {
                    message = "Both email and mobile are already registered.";
                } else if (existingData.email === email) {
                    message = "Email is already registered.";
                } else if (existingData.mobile === mobile) {
                    message = "Mobile number is already registered.";
                }

                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: message,
                    data: null
                }, 400);
            }

            // ✅ Proceed with user creation
            const userData = { username, email, password: hashedPassword, mobile, fullname, dob, login_type, social_id, verifyWith };

            userModel.createUser(userData, (err, result) => {
                if (err) {
                    return common.response(res, err, 500);
                }

                const userId = result.insertId; // Use insertId from MySQL result
                const otp = common.generateOtp();
                const token = common.generateToken();

                // ✅ Store OTP and Token
                userModel.createVerification(userId, otp, 'SignUp', verifyWith, token, (err, otpResult) => {
                    if (err) {
                        return common.response(res, err, 500);
                    }

                    // ✅ Store Device Info
                    userModel.addDeviceInfo(userId, deviceInfo || {}, (deviceErr) => {
                        if (deviceErr) {
                            return common.response(res, deviceErr, 500);
                        }

                        delete userData.password; // Remove password from response

                        // ✅ Success response
                        common.response(res, {
                            code: responseCode.SUCCESS,
                            message: "User registered successfully. OTP sent.",
                            data: {
                                userId,
                                userData,
                                otp, // In production, send via Email/SMS
                                token,
                                verificationId: otpResult.data.verificationId,
                                deviceInfo
                            }
                        });
                    });
                });
            });
        });
    }

    // ✅ Get all available languages
    getLanguages(req, res) {
        userModel.getLanguages((err, results) => {
            if (err) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: "Failed to fetch languages.",
                    data: err
                }, 500);
            }

            return common.response(res, {
                code: responseCode.SUCCESS,
                message: "Languages fetched successfully.",
                data: results
            });
        });
    }

    // ✅ Set user language
    setUserLanguage(req, res) {
        const { userId, languageId } = req.body;

        // Validate input
        if (!userId || !languageId) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId and languageId are required.",
                data: null
            }, 400);
        }

        // Call model function to insert language
        userModel.setUserLanguage(userId, languageId, (err, result) => {
            if (err) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: "Failed to set language.",
                    data: err
                }, 500);
            }

            return common.response(res, {
                code: responseCode.SUCCESS,
                message: "Language set successfully.",
                data: { userId, languageId }
            });
        });
    }

    // Login
    login(req, res) {
        const { identifier, password, action, verify_with } = req.body;  // ✅ Get action & verify_with from req.body
        const hashedPassword = common.hashPassword(password);

        // ✅ Validate verify_with
        if (!['E', 'M'].includes(verify_with)) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "Invalid verify_with value. Use 'E' for Email or 'M' for Mobile.",
                data: null
            }, 400);
        }

        userModel.getUserByIdentifier(identifier, (err, user) => {
            if (err) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: err.message,
                    data: null
                }, 500);
            }
            if (!user || !user.data) {
                return common.response(res, { code: responseCode.NO_DATA_FOUND, message: "User not found", data: null }, 404);
            }
            if (user.data.password !== hashedPassword) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: "Invalid credentials",
                    data: null
                }, 401);
            }

            // ✅ Generate custom token
            const token = common.generateToken();

            // ✅ Validate action
            if (!action) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: "Action is required.",
                    data: null
                }, 400);
            }

            // ✅ Update token, action & verify_with in tbl_verification
            userModel.updateTokenActionAndVerify(user.data.id, token, action, verify_with, (updateErr) => {
                if (updateErr) {
                    return common.response(res, updateErr, 500);
                }

                common.response(res, {
                    code: responseCode.SUCCESS,
                    message: "Login successful",
                    data: {
                        token,
                        action,
                        verify_with,
                        user: {
                            id: user.data.id,
                            email: user.data.email,
                            mobile: user.data.mobile
                        }
                    }
                });
            });
        });
    }




    // Get User by Email or Mobile
    getUserByEmailOrMobile(req, res) {
        const { email, mobile } = req.body;

        // Validate input
        if (!email && !mobile) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "Please provide either email or mobile to fetch user.",
                data: null
            }, 400);
        }

        // Fetch user from DB
        userModel.getUserByEmailOrMobile(email, mobile, (err, user) => {
            if (err) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: "Error fetching user.",
                    data: null
                }, 500);
            }

            if (!user.data) {
                return common.response(res, {
                    code: responseCode.NO_DATA_FOUND,
                    message: "No user found with the provided email or mobile.",
                    data: null
                }, 404);
            }

            // Success response
            common.response(res, {
                code: responseCode.SUCCESS,
                message: "User fetched successfully.",
                data: user.data
            });
        });
    }

    // =======================
    // ✅ OTP Creation API
    // =======================
    createOtp(req, res) {
        const { userId, action, verifyWith } = req.body;

        // Basic validation
        if (!userId || !action || !verifyWith) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId, action, and verifyWith are required.",
                data: null
            }, 400);
        }

        const otp = common.generateOtp(); // Generate OTP
        const token = common.generateToken(); // Generate Token

        userModel.createVerification(userId, otp, action, verifyWith, token, (err, result) => {
            if (err) {
                return common.response(res, err, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "OTP and token generated successfully.",
                data: {
                    otp, // In production, send this via Email/SMS
                    token,
                    verificationId: result.data.verificationId
                }
            });
        });
    }

    // =======================
    // ✅ OTP Verification API
    // =======================
    verifyOtp(req, res) {
        const { userId, otp, action } = req.body;

        // Basic validation
        if (!userId || !otp || !action) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId, otp, and action are required.",
                data: null
            }, 400);
        }

        userModel.verifyOtp(userId, otp, action, (err, result) => {
            if (err) {
                return common.response(res, err, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "OTP verified successfully.",
                data: result.data
            });
        });
    }

    // Resend OTP
    resendOtp(req, res) {

        const { userId, action, verifyWith } = req.body;

        if (!userId || !action || !verifyWith) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId, action, and verifyWith are required.",
                data: null
            }, 400);
        }

        const otp = common.generateOtp();
        const token = common.generateToken();

        userModel.createVerification(userId, otp, action, verifyWith, token, (err, otpResult) => {
            if (err) {

                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: "Failed to create verification.",
                    data: err
                }, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "OTP resent successfully.",
                data: {
                    userId,
                    otp, // In production, send via Email/SMS
                    verificationId: otpResult.data.verificationId
                }
            });
        });
    }

    // Forgot Password
    forgotPassword(req, res) {
        const { identifier } = req.body; // identifier can be email or mobile

        if (!identifier) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "Identifier (email or mobile) is required.",
                data: null
            }, 400);
        }

        userModel.getUserByIdentifier(identifier, (err, user) => {
            if (err) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: err.message,
                    data: null
                }, 500);
            }
            if (!user || !user.data) {
                return common.response(res, { code: responseCode.NO_DATA_FOUND, message: "User not found", data: null }, 404);
            }

            const userId = user.data.id;
            const otp = common.generateOtp();
            const token = common.generateToken();

            userModel.createVerification(userId, otp, 'Forget', identifier, token, (err, otpResult) => {
                if (err) {
                    return common.response(res, err, 500);
                }

                common.response(res, {
                    code: responseCode.SUCCESS,
                    message: "OTP generated successfully.",
                    data: {
                        userId,
                        otp, // In production, send this via Email/SMS
                        token,
                        verificationId: otpResult.data.verificationId
                    }
                });
            });
        });
    }

    verifyForgotPasswordOtp(req, res) {
        const { userId, otp, action } = req.body;

        if (!userId || !otp || !action) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId, otp, and action are required.",
                data: null
            }, 400);
        }

        userModel.verifyOtp(userId, otp, action, (err, result) => {
            if (err) {
                return common.response(res, err, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "OTP verified successfully.",
                data: result.data
            });
        });
    }

    changePassword(req, res) {
        const { userId, oldPassword, newPassword } = req.body;

        if (!userId || !oldPassword || !newPassword) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId, oldPassword, and newPassword are required.",
                data: null
            }, 400);
        }

        if (oldPassword === newPassword) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "New password cannot be the same as the old password.",
                data: null
            }, 400);
        }

        userModel.getUserById(userId, (err, user) => {
            if (err) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: err.message,
                    data: null
                }, 500);
            }
            if (!user || !user.data) {
                return common.response(res, { code: responseCode.NO_DATA_FOUND, message: "User not found", data: null }, 404);
            }

            const hashedOldPassword = common.hashPassword(oldPassword);
            if (user.data.password !== hashedOldPassword) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: "Old password is incorrect.",
                    data: null
                }, 401);
            }

            const hashedNewPassword = common.hashPassword(newPassword);
            userModel.updatePassword(userId, hashedNewPassword, (err, result) => {
                if (err) {
                    return common.response(res, err, 500);
                }

                common.response(res, {
                    code: responseCode.SUCCESS,
                    message: "Password updated successfully.",
                    data: result.data
                });
            });
        });
    }


    updatePassword(req, res) {
        const { userId, currentPassword, newPassword, confirmPassword } = req.body; // Get userId from request body

        // Validate required fields
        if (!userId || !currentPassword || !newPassword || !confirmPassword) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId, currentPassword, newPassword, and confirmPassword are required.",
                data: null
            }, 400);
        }

        // Check if new password and confirm password match
        if (newPassword !== confirmPassword) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "New password and confirm password do not match.",
                data: null
            }, 400);
        }

        // Fetch the user by ID to verify the current password
        userModel.getUserById(userId, (err, user) => {
            if (err) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: err.message,
                    data: null
                }, 500);
            }

            if (!user || !user.data) {
                return common.response(res, {
                    code: responseCode.NO_DATA_FOUND,
                    message: "User  not found.",
                    data: null
                }, 404);
            }

            // Verify the current password
            const hashedCurrentPassword = common.hashPassword(currentPassword);
            if (user.data.password !== hashedCurrentPassword) {
                return common.response(res, {
                    code: responseCode.OPERATION_FAILED,
                    message: "Current password is incorrect.",
                    data: null
                }, 401);
            }

            // Hash the new password
            const hashedNewPassword = common.hashPassword(newPassword);

            // Update the password in the database
            userModel.updatePassword(userId, hashedNewPassword, (err, result) => {
                if (err) {
                    return common.response(res, err, 500);
                }

                common.response(res, {
                    code: responseCode.SUCCESS,
                    message: "Password updated successfully.",
                    data: null
                });
            });
        });
    }

    //----------------applicaion related controllers----------------//

    // Controller to fetch all post styles
    getAllPostStyles = (req, res) => {
        userModel.getAllPostStyles((err, result) => {
            if (err) {
                return res.status(500).json(err);
            }
            res.status(200).json(result);
        });
    };

    // Fetch all categories
    getAllCategories = (req, res) => {
        userModel.getAllCategories((err, result) => {
            if (err) return res.status(500).json(err);
            res.status(200).json(result);
        });
    };


    createPost(req, res) {
        const { userId, description, categories_id, style, style_thumbnail, video, video_duration, images, tags, created_at, expiring_on } = req.body;

        // Validate required fields
        if (!userId || !description || !categories_id || !style || !created_at || !expiring_on) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId, description, categories_id, style, created_at, and expiring_on are required.",
                data: null
            }, 400);
        }

        // Insert the post
        userModel.createPost({ userId, description, categories_id, style, style_thumbnail, created_at, expiring_on }, (err, postResult) => {
            if (err) {
                return common.response(res, err, 500);
            }

            const postId = postResult.insertId; // Get the newly created post ID

            // Check if the post is a video
            if (video && video_duration) {
                // Insert video for the post with dynamic video duration
                userModel.addPostImage({ type: 'Video', image: video, postId, video_duration }, (videoErr) => {
                    if (videoErr) {
                        return common.response(res, videoErr, 500);
                    }
                });
            }

            // Insert images for the post
            let imageInsertCount = 0; // Counter for images
            if (images && images.length > 0) {
                images.forEach(image => {
                    userModel.addPostImage({ type: image.type, image: image.image, postId }, (imageErr) => {
                        if (imageErr) {
                            return common.response(res, imageErr, 500);
                        }
                        imageInsertCount++;
                        // Check if all images have been inserted
                        if (imageInsertCount === images.length) {
                            // Now insert tags for the post if they exist
                            if (tags && tags.length > 0) {
                                let tagInsertCount = 0; // Counter for tags
                                tags.forEach(tagId => {
                                    userModel.addPostTag({ tagId, postId }, (tagErr) => {
                                        if (tagErr) {
                                            return common.response(res, tagErr, 500);
                                        }
                                        tagInsertCount++;

                                        // Check if all tags have been inserted
                                        if (tagInsertCount === tags.length) {
                                            // All images and tags inserted successfully
                                            common.response(res, {
                                                code: responseCode.SUCCESS,
                                                message: "Post created successfully.",
                                                data: { userId, postId }
                                            });
                                        }
                                    });
                                });
                            } else {
                                // If no tags, respond with success
                                common.response(res, {
                                    code: responseCode.SUCCESS,
                                    message: "Post created successfully.",
                                    data: { postId, userId }
                                });
                            }
                        }
                    });
                });
            } else {
                // If no images, respond with success
                common.response(res, {
                    code: responseCode.SUCCESS,
                    message: "Post created successfully.",
                    data: { postId, userId }
                });
            }
        });
    }



    getStylComparePosts(req, res) {
        userModel.fetchStylComparePosts((err, results) => {
            if (err) {
                return common.response(res, err, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "StylCompare posts fetched successfully.",
                data: results
            });
        });
    }


    getStylVideoPosts(req, res) {
        userModel.fetchStylVideoPosts((err, results) => {
            if (err) {
                return common.response(res, err, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "StylVideo posts fetched successfully.",
                data: results
            });
        });
    }

    getUserProfile(req, res) {
        const { userId } = req.body;

        // Validate that userId is provided
        if (!userId) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId is required.",
                data: null
            }, 400);
        }

        userModel.fetchUserProfile(userId, (err, result) => {
            if (err) {
                return common.response(res, err, 500);
            }

            if (!result) {
                return common.response(res, {
                    code: responseCode.NO_DATA_FOUND,
                    message: "User  not found.",
                    data: null
                }, 404);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "User  profile fetched successfully.",
                data: result
            });
        });
    }


    getAllPosts(req, res) {
        userModel.fetchAllPosts((err, results) => {
            if (err) {
                return common.response(res, err, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "All posts fetched successfully.",
                data: results
            });
        });
    }

    getPostsByStyle(req, res) {
        const { style } = req.body; // Get style from request body

        // Validate that style is provided
        if (!style) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "Style is required.",
                data: null
            }, 400);
        }

        userModel.fetchPostsByStyle(style, (err, results) => {
            if (err) {
                return common.response(res, err, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: `Posts with style ${style} fetched successfully.`,
                data: results
            });
        });
    }

    getSavedPosts(req, res) {
        const { user_id } = req.body; // Get user_id from request body

        // Validate that user_id is provided
        if (!user_id) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "user_id is required.",
                data: null
            }, 400);
        }

        userModel.fetchSavedPostsByUserId(user_id, (err, results) => {
            if (err) {
                return common.response(res, err, 500);
            }

            if (results.length === 0) {
                return common.response(res, {
                    code: responseCode.NO_DATA_FOUND,
                    message: "No saved posts found for this user.",
                    data: null
                }, 404);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "Saved posts fetched successfully.",
                data: results
            });
        });
    }

    getPostImagesByRating(req, res) {
        const { postId } = req.body; // Get postId from request body

        // Validate that postId is provided
        if (!postId) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "postId is required.",
                data: null
            }, 400);
        }

        // Call the model method to fetch images by like count
        userModel.fetchImagesByLikeCount(postId, (err, results) => {
            if (err) {
                return common.response(res, err, 500);
            }

            if (results.length === 0) {
                return common.response(res, {
                    code: responseCode.NO_DATA_FOUND,
                    message: "No images found for this post.",
                    data: null
                }, 404);
            }
            console.log(results);
            common.response(res, {
                code: responseCode.SUCCESS,
                message: "Images fetched successfully.",
                data: results
            });
        });
    }

    updateUserProfile(req, res) {
        const { username, email, country_code, bio, fullname, user_id, mobile } = req.body; // Get data from request body

        // Validate that required fields are provided
        if (!username || !email || !country_code || !bio || !fullname || !user_id) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "All fields except mobile are required.",
                data: null
            }, 400);
        }

        // Check if mobile is being updated
        if (mobile) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "Mobile number cannot be updated.",
                data: null
            }, 400);
        }

        userModel.updateUserProfile(username, email, country_code, bio, fullname, user_id, (err, result) => {
            if (err) {
                return common.response(res, err, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "User  profile updated successfully.",
                data: null
            });
        });
    }

    createBlog(req, res) {
        const { user_id, blog_image, description, title } = req.body; // Get data from request body

        // Validate required fields
        if (!user_id || !blog_image || !description || !title) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "user_id, blog_image, description, and title are required.",
                data: null
            }, 400);
        }

        // Call the model method to insert the blog
        userModel.insertBlog({ user_id, blog_image, description, title }, (err, result) => {
            if (err) {
                return common.response(res, err, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "Blog created successfully.",
                data: { user_id, blog_image, description, title }
            });
        });
    }

    createContactUsEntry(req, res) {
        const { full_name, email, subject, description } = req.body; // Get data from request body

        // Validate required fields
        if (!full_name || !email || !subject || !description) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "full_name, email, subject, and description are required.",
                data: null
            }, 400);
        }

        // Call the model method to insert the contact us entry
        userModel.insertContactUsEntry({ full_name, email, subject, description }, (err, result) => {
            if (err) {
                return common.response(res, err, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "Contact us entry created successfully.",
                data: { full_name, email, subject, description }
            });
        });
    }

    deletePost(req, res) {
        const { postId } = req.body; // Get postId from request parameters

        // Validate that postId is provided
        if (!postId) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "postId is required.",
                data: null
            }, 400);
        }

        // Call the model method to delete related post images
        userModel.deletePostImages(postId, (err) => {
            if (err) {
                return common.response(res, err, 500);
            }

            // Call the model method to delete related post tags
            userModel.deletePostTags(postId, (err) => {
                if (err) {
                    return common.response(res, err, 500);
                }

                // Call the model method to delete the post
                userModel.deletePost(postId, (err) => {
                    if (err) {
                        return common.response(res, err, 500);
                    }

                    common.response(res, {
                        code: responseCode.SUCCESS,
                        message: "Post and related data deleted successfully.",
                        data: { postId }
                    });
                });
            });
        });
    }
    logout(req, res) {
        const { userId } = req.body; // Get userId from request body

        // Validate that userId is provided
        if (!userId) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId is required.",
                data: null
            }, 400);
        }

        // Call the model method to update the user's status to inactive
        userModel.logoutUser(userId, (err) => {
            if (err) {
                return common.response(res, err, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "User  logged out successfully.",
                data: { userId }
            });
        });
    }

    deleteAccount(req, res) {
        const { userId } = req.body; // Get userId from request body

        // Validate that userId is provided
        if (!userId) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId is required.",
                data: null
            }, 400);
        }

        // Soft delete related data in various tables
        userModel.softDeleteUserData(userId, (err) => {
            if (err) {
                return common.response(res, err, 500);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "User  account and related data deleted successfully.",
                data: null
            });
        });
    }

    getTrendingPosts(req, res) {
        // Call the model method to fetch trending posts
        userModel.fetchTrendingPosts((err, results) => {
            if (err) {
                return common.response(res, err, 500);
            }

            if (results.length === 0) {
                return common.response(res, {
                    code: responseCode.NO_DATA_FOUND,
                    message: "No trending posts found.",
                    data: null
                }, 404);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "Trending posts fetched successfully.",
                data: results
            });
        });
    }

    getNewPosts(req, res) {
        const { style } = req.body; // Get style from request body

        // Call the model method to fetch new posts
        userModel.fetchNewPosts(style, (err, results) => {
            if (err) {
                return common.response(res, err, 500);
            }

            if (results.length === 0) {
                return common.response(res, {
                    code: responseCode.NO_DATA_FOUND,
                    message: "No new posts found.",
                    data: null
                }, 404);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "New posts fetched successfully.",
                data: results
            });
        });
    }

    getPostsByFollowingUsers(req, res) {
        const userId = req.body.userId; // Get userId from request body
        const { style } = req.body; // Get style from request body

        // Validate that userId is provided
        if (!userId) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId is required.",
                data: null
            }, 400);
        }

        // Call the model method to fetch posts by following users
        userModel.fetchPostsByFollowingUsers(userId, style, (err, results) => {
            if (err) {
                return common.response(res, err, 500);
            }

            if (results.length === 0) {
                return common.response(res, {
                    code: responseCode.NO_DATA_FOUND,
                    message: "No posts found from following users.",
                    data: null
                }, 404);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "Posts from following users fetched successfully.",
                data: results
            });
        });
    }

    getExpiringPosts(req, res) {
        const { style } = req.body; // Get style from request body

        // Call the model method to fetch expiring posts
        userModel.fetchExpiringPosts(style, (err, results) => {
            if (err) {
                return common.response(res, err, 500);
            }

            if (results.length === 0) {
                return common.response(res, {
                    code: responseCode.NO_DATA_FOUND,
                    message: "No expiring posts found.",
                    data: null
                }, 404);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "Expiring posts fetched successfully.",
                data: results
            });
        });
    }

    getPostsByCategory(req, res) {
        const { categoryId } = req.body; // Get categoryId from request body

        // Validate that categoryId is provided
        if (!categoryId) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "categoryId is required.",
                data: null
            }, 400);
        }

        // Validate that categoryId is one of the allowed values (1, 2, or 3)
        const validCategoryIds = [1, 2, 3];
        if (!validCategoryIds.includes(categoryId)) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "categoryId must be one of the following values: 1, 2, or 3.",
                data: null
            }, 400);
        }

        // Call the model method to fetch posts by category
        userModel.fetchPostsByCategory(categoryId, (err, results) => {
            if (err) {
                return common.response(res, err, 500);
            }

            if (results.length === 0) {
                return common.response(res, {
                    code: responseCode.NO_DATA_FOUND,
                    message: "No posts found for this category.",
                    data: null
                }, 404);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "Posts fetched successfully.",
                data: results
            });
        });
    }

    getOtherUserProfile(req, res) {
        const { userId, currentUserId } = req.body; // Get userId and currentUser Id from request body

        // Validate that userId and currentUser Id are provided
        if (!userId || !currentUserId) {
            return common.response(res, {
                code: responseCode.OPERATION_FAILED,
                message: "userId and currentUser Id are required.",
                data: null
            }, 400);
        }

        // Call the model method to fetch user profile
        userModel.fetchOtherUserProfile(userId, currentUserId, (err, results) => {
            if (err) {
                return common.response(res, err, 500);
            }

            if (results.length === 0) {
                return common.response(res, {
                    code: responseCode.NO_DATA_FOUND,
                    message: "User  profile not found.",
                    data: null
                }, 404);
            }

            common.response(res, {
                code: responseCode.SUCCESS,
                message: "User  profile fetched successfully.",
                data: { results: results[0] } // Return the first result
            });
        });
    }
}


module.exports = new User();
