let responseCode = require('../../../../utilities/response-error-code');
let database = require('../../../../config/database');

class UserModel {
    // Dummy function to fetch example data
    getExampleData(callback) {
        const query = `SELECT 'Hello, World!' AS message`; // Simple query to return a message

        database.query(query, [], (err, results) => {
            if (err) {
                return callback({
                    code: responseCode.OPERATION_FAILED,
                    message: err.message,
                    data: null
                }, null);
            }

            callback(null, results[0]); // Return the first row
        });
    }

    getUserById(userId, callback) {
        const query = `SELECT * FROM tbl_users WHERE id = ? AND is_active = 1 AND is_deleted = 0 LIMIT 1`;
        database.query(query, [userId], (err, results) => {
            if (err) {
                return callback({ code: responseCode.OPERATION_FAILED, message: err.message, data: null }, null);
            }
            if (results.length === 0) {
                return callback({ code: responseCode.NO_DATA_FOUND, message: "User not found", data: null }, null);
            }
            callback(null, { code: responseCode.SUCCESS, message: "User retrieved successfully", data: results[0] });
        });
    }

    // Create user in the database
    createUser(userData, callback) {
        const query = `
            INSERT INTO tbl_users 
            (username, email, password, mobile, fullname, dob, login_type, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        const params = [
            userData.username,
            userData.email,
            userData.password,
            userData.mobile,
            userData.fullname,
            userData.dob,
            userData.login_type,
        ];


        database.query(query, params, (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    }

    // ✅ Fetch all available languages
    getLanguages(callback) {
        const query = "SELECT * FROM tbl_languages";
        database.query(query, (err, results) => {
            if (err) return callback(err, null);
            return callback(null, results);
        });
    }

    // ✅ Insert selected language for user
    setUserLanguage(userId, languageId, callback) {
        const query = "INSERT INTO tbl_user_languages (user_id, language_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE language_id = ?";
        database.query(query, [userId, languageId, languageId], (err, result) => {
            if (err) return callback(err, null);
            return callback(null, result);
        });
    }

    // Fetch user by Email or Mobile
    getUserByEmailOrMobile(email, mobile, callback) {
        let query = `SELECT * FROM tbl_users WHERE `;
        let params = [];

        if (email) {
            query += `email = ? `;
            params.push(email);
        }

        if (email && mobile) query += `OR `;

        if (mobile) {
            query += `mobile = ? `;
            params.push(mobile);
        }

        database.query(query, params, (err, results) => {
            if (err) return callback(err);
            callback(null, results.length ? { data: results[0] } : { data: null });
        });
    }

    // otp creation
    createVerification(userId, otp, action, verifyWith, token, callback) {
        const query = `
        INSERT INTO tbl_verifications 
        (user_id, otp, token, action, verify_with, created_at) 
        VALUES (?, ?, ?, ?, ?, NOW())
    `;

        database.query(query, [userId, otp, token, action, verifyWith], (err, results) => {
            if (err) {
                return callback({
                    code: responseCode.OPERATION_FAILED,
                    message: err.message,
                    data: null
                }, null);
            }

            callback(null, {
                code: responseCode.SUCCESS,
                message: "OTP and token generated successfully",
                data: { verificationId: results.insertId }
            });
        });
    }

    createOtpVerification(userId, otp, action, verifyWith, callback) {
        const query = `
        INSERT INTO tbl_verifications 
        (user_id, otp, action, verify_with, created_at) 
        VALUES (?, ?, ?, ?, NOW())
    `;

        database.query(query, [userId, otp, action, verifyWith], (err, results) => {
            if (err) {
                return callback({
                    code: responseCode.OPERATION_FAILED,
                    message: err.message,
                    data: null
                }, null);
            }

            callback(null, {
                code: responseCode.SUCCESS,
                message: "OTP generated successfully",
                data: { verificationId: results.insertId }
            });
        });
    }

    // update tokan, action and verify while login
    updateTokenActionAndVerify = (userId, token, action, verify_with, callback) => {
        const query = `
                UPDATE tbl_verification 
                SET token = ?, action = ?, verify_with = ?, updated_at = NOW() 
                WHERE user_id = ?
            `;

        database.query(query, [token, action, verify_with, userId], (err, result) => {
            if (err) {
                return callback({
                    code: responseCode.OPERATION_FAILED,
                    message: "Failed to update token, action, and verify_with",
                    data: err
                });
            }
            callback(null, {
                code: responseCode.SUCCESS,
                message: "Token, action, and verify_with updated successfully",
                data: result
            });
        });
    };

    // otp verification
    verifyOtp(userId, otp, action, callback) {
        const query = `
                SELECT * FROM tbl_verifications 
                WHERE user_id = ? AND otp = ? AND action = ? AND is_active = 1 AND is_deleted = 0 AND created_at >= NOW() - INTERVAL 5 MINUTE`;

        database.query(query, [userId, otp, action], (err, results) => {
            if (err) {
                return callback({
                    code: responseCode.OPERATION_FAILED,
                    message: err.message,
                    data: null
                }, null);
            }

            if (results.length === 0) {
                return callback({
                    code: responseCode.NO_DATA_FOUND,
                    message: "Invalid or expired OTP",
                    data: null
                }, null);
            }

            // Mark OTP as used (soft delete or deactivate)
            const updateQuery = `
            UPDATE tbl_verifications 
            SET is_active = 0, deleted_at = NOW() 
            WHERE id = ?`;

            database.query(updateQuery, [results[0].id], (updateErr) => {
                if (updateErr) {
                    return callback({
                        code: responseCode.OPERATION_FAILED,
                        message: updateErr.message,
                        data: null
                    }, null);
                }

                callback(null, {
                    code: responseCode.SUCCESS,
                    message: "OTP verified successfully",
                    data: { userId: userId, otp: otp, action: action }
                });
            });
        });
    }

    // add device information
    addDeviceInfo(userId, deviceInfo = {}, callback) {
        const { time_zone, device_type, device_token, os_version, app_version } = deviceInfo;
        const query = `
            INSERT INTO tbl_device 
            (user_id, time_zone, device_type, device_token, os_version, app_version, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `;

        database.query(query, [userId, time_zone, device_type, device_token, os_version, app_version], (err, results) => {
            if (err) {
                return callback({
                    code: responseCode.OPERATION_FAILED,
                    message: err.message,
                    data: null
                }, null);
            }
            callback(null, {
                code: responseCode.SUCCESS,
                message: "Device information added successfully",
                data: { id: results.insertId }
            });
        });
    }

    // update tokan, action and verify while login
    updateTokenActionAndVerify = (userId, token, action, verify_with, callback) => {
        const query = `
            UPDATE tbl_verifications 
            SET token = ?, action = ?, verify_with = ?, updated_at = NOW() 
            WHERE user_id = ?
        `;

        database.query(query, [token, action, verify_with, userId], (err, result) => {
            if (err) {
                return callback({
                    code: responseCode.OPERATION_FAILED,
                    message: "Failed to update token, action, and verify_with",
                    data: err
                });
            }
            callback(null, {
                code: responseCode.SUCCESS,
                message: "Token, action, and verify_with updated successfully",
                data: result
            });
        });
    };

    // login user : email or mobile and password
    getUserByIdentifier(identifier, callback) {
        const query = `
        SELECT * FROM tbl_users 
        WHERE (email = ? OR mobile = ?) 
        AND is_active = 1 AND is_deleted = 0 LIMIT 1
    `;
        database.query(query, [identifier, identifier], (err, results) => {
            if (err) {
                return callback({ code: responseCode.OPERATION_FAILED, message: err.message, data: null }, null);
            }
            if (results.length === 0) {
                return callback({ code: responseCode.NO_DATA_FOUND, message: "User not found", data: null }, null);
            }
            callback(null, { code: responseCode.SUCCESS, message: "User retrieved successfully", data: results[0] });
        });
    }

    updatePassword(userId, hashedPassword, callback) {
        const query = 'UPDATE tbl_users SET password = ?, updated_at = NOW() WHERE id = ? AND is_active = 1 AND is_deleted = 0';

        database.query(query, [hashedPassword, userId], (err, results) => {
            if (err) {
                return callback({
                    code: responseCode.OPERATION_FAILED,
                    message: err.message,
                    data: null
                }, null);
            }

            if (results.affectedRows === 0) {
                return callback({
                    code: responseCode.NO_DATA_FOUND,
                    message: "User not found or not active",
                    data: null
                }, null);
            }

            callback(null, {
                code: responseCode.SUCCESS,
                message: "Password updated successfully",
                data: { affectedRows: results.affectedRows }
            });
        });
    }


    //---------application realted modals------------------//

    // Fetch all post styles
    getAllPostStyles(callback) {
        const query = `SELECT DISTINCT(style) AS category FROM tbl_posts`;

        database.query(query, [], (err, results) => {
            if (err) {
                return callback({
                    code: responseCode.OPERATION_FAILED,
                    message: 'Failed to fetch post categories',
                    data: null
                }, null);
            }

            callback(null, {
                code: responseCode.SUCCESS,
                message: 'Post categories fetched successfully',
                data: results
            });
        });
    }


    // Fetch all categories
    getAllCategories(callback) {
        const query = `SELECT id AS category_id,category AS category_name, logo AS category_logo FROM tbl_categories`;

        database.query(query, [], (err, results) => {
            if (err) {
                return callback({
                    code: responseCode.OPERATION_FAILED,
                    message: 'Failed to fetch categories',
                    data: null
                }, null);
            }

            callback(null, {
                code: responseCode.SUCCESS,
                message: 'Categories fetched successfully',
                data: results
            });
        });
    }


    // Create a new post
    // Create a new post
    createPost(postData, callback) {
        const query = `
    INSERT INTO tbl_posts 
    (user_id, description, categories_id, style, style_thumbnail, created_at, expiring_on) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
`;

        const params = [
            postData.userId,
            postData.description,
            postData.categories_id,
            postData.style,
            postData.style_thumbnail,
            postData.created_at, // Use the created_at from postData
            postData.expiring_on // Use the expiring_on from postData
        ];

        database.query(query, params, (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    }

    // Add post image or video
    addPostImage(imageData, callback) {
        const query = `
    INSERT INTO tbl_post_images 
    (type, image, video_duration, post_id) 
    VALUES (?, ?, ?, ?)
`;

        const params = [
            imageData.type,
            imageData.image,
            imageData.video_duration || null, // Include video_duration if it exists
            imageData.postId,
        ];

        database.query(query, params, (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    }

    // Add post tag
    addPostTag(tagData, callback) {
        const query = `
    INSERT INTO tbl_post_tags 
    (tag_id, post_id) 
    VALUES (?, ?)
`;

        const params = [
            tagData.tagId,
            tagData.postId,
        ];

        database.query(query, params, (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    }

    // Add post image
    addPostImage(imageData, callback) {
        const query = `
        INSERT INTO tbl_post_images 
        (type, image, post_id) 
        VALUES (?, ?, ?)
    `;

        const params = [
            imageData.type,
            imageData.image,
            imageData.postId,
        ];

        database.query(query, params, (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    }

    // Add post tag
    addPostTag(tagData, callback) {
        const query = `
        INSERT INTO tbl_post_tags 
        (tag_id, post_id) 
        VALUES (?, ?)
    `;

        const params = [
            tagData.tagId,
            tagData.postId,
        ];

        database.query(query, params, (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    }

    fetchImagesByLikeCount(postId, callback) {
        const query = `
            SELECT
                pi.id AS image_id,
                p.id AS post_id, 
                pi.image,
                COUNT(l.id) AS like_count
            FROM tbl_posts p
            JOIN tbl_post_images pi ON p.id = pi.post_id
            LEFT JOIN tbl_likes l ON pi.id = l.image_id
            WHERE p.expiring_on < NOW() AND p.id = ?
            GROUP BY pi.image
            ORDER BY like_count DESC;
        `;

        database.query(query, [postId], (err, results) => {
            if (err) return callback(err);
            callback(null, results); // Return the results of the query
        });
    }

    fetchStylComparePosts(callback) {
        const query = `
            SELECT 
                u.username,
                u.profile_image,
                CASE
                    WHEN TIMESTAMPDIFF(MINUTE, p.created_at, NOW()) < 60 THEN CONCAT(TIMESTAMPDIFF(MINUTE, p.created_at, NOW()), ' minutes ago')
                    WHEN TIMESTAMPDIFF(HOUR, p.created_at, NOW()) < 24 THEN CONCAT(TIMESTAMPDIFF(HOUR, p.created_at, NOW()), ' hours ago')
                    WHEN TIMESTAMPDIFF(DAY, p.created_at, NOW()) < 7 THEN CONCAT(TIMESTAMPDIFF(DAY, p.created_at, NOW()), ' days ago')
                    WHEN TIMESTAMPDIFF(WEEK, p.created_at, NOW()) < 4 THEN CONCAT(TIMESTAMPDIFF(WEEK, p.created_at, NOW()), ' weeks ago')
                    WHEN TIMESTAMPDIFF(MONTH, p.created_at, NOW()) < 12 THEN CONCAT(TIMESTAMPDIFF(MONTH, p.created_at, NOW()), ' months ago')
                    ELSE DATE_FORMAT(p.created_at, '%Y-%m-%d')
                END AS post_created_time,
                c.category AS category_name,
                TIME_FORMAT(p.expiring_on, '%H:%i:%s') AS expiring_time,
                p.description,
                p.total_comments,
                p.style,
                p.id AS post_id,
                GROUP_CONCAT(pi.image) AS post_images,
                GROUP_CONCAT(t.tag) AS tags
            FROM tbl_posts p
            JOIN tbl_users u ON p.user_id = u.id
            JOIN tbl_categories c ON p.categories_id = c.id
            LEFT JOIN tbl_post_images pi ON p.id = pi.post_id
            LEFT JOIN tbl_post_tags pt ON p.id = pt.post_id
            LEFT JOIN tbl_tags t ON pt.tag_id = t.id
            WHERE p.style = 'ToStylCompare'
            GROUP BY p.id, u.username, u.profile_image, p.created_at, c.category, p.expiring_on, p.description, p.total_comments, p.avg_rating, p.style;
        `;

        database.query(query, [], (err, results) => {
            if (err) return callback(err);
            callback(null, results);
        });
    }


    fetchStylVideoPosts(callback) {
        const query = `
            SELECT 
                u.username,
                u.profile_image,
                CASE
                    WHEN TIMESTAMPDIFF(MINUTE, p.created_at, NOW()) < 60 THEN CONCAT(TIMESTAMPDIFF(MINUTE, p.created_at, NOW()), ' minutes ago')
                    WHEN TIMESTAMPDIFF(HOUR, p.created_at, NOW()) < 24 THEN CONCAT(TIMESTAMPDIFF(HOUR, p.created_at, NOW()), ' hours ago')
                    WHEN TIMESTAMPDIFF(DAY, p.created_at, NOW()) < 7 THEN CONCAT(TIMESTAMPDIFF(DAY, p.created_at, NOW()), ' days ago')
                    WHEN TIMESTAMPDIFF(WEEK, p.created_at, NOW()) < 4 THEN CONCAT(TIMESTAMPDIFF(WEEK, p.created_at, NOW()), ' weeks ago')
                    WHEN TIMESTAMPDIFF(MONTH, p.created_at, NOW()) < 12 THEN CONCAT(TIMESTAMPDIFF(MONTH, p.created_at, NOW()), ' months ago')
                    ELSE DATE_FORMAT(p.created_at, '%Y-%m-%d')
                END AS post_created_time,
                c.category AS category_name,
                TIME_FORMAT(p.expiring_on, '%H:%i:%s') AS expiring_time,
                p.description,
                p.total_comments,
                p.avg_rating,
                p.style,
                p.id as post_id,
                GROUP_CONCAT(pi.image) AS post_images,
                GROUP_CONCAT(t.tag) AS tags
            FROM tbl_posts p
            JOIN tbl_users u ON p.user_id = u.id
            JOIN tbl_categories c ON p.categories_id = c.id
            LEFT JOIN tbl_post_images pi ON p.id = pi.post_id
            LEFT JOIN tbl_post_tags pt ON p.id = pt.post_id
            LEFT JOIN tbl_tags t ON pt.tag_id = t.id
            WHERE p.style = 'ToStylVideo'
            GROUP BY p.id, u.username, u.profile_image, p.created_at, c.category, p.expiring_on, p.description, p.total_comments, p.avg_rating, p.style;
        `;

        database.query(query, [], (err, results) => {
            if (err) return callback(err);
            callback(null, results);
        });
    }

    fetchUserProfile(userId, callback) {
        const query = `
            SELECT 
                u.profile_image,
                u.username,
                u.bio,
                (SELECT COUNT(*) FROM tbl_follow WHERE following_to = u.id AND status = 'accepted') AS total_followers,
                (SELECT COUNT(*) FROM tbl_follow WHERE followed_by = u.id AND status = 'accepted') AS total_following,
                u.total_Retreate,
                u.total_myRatings
            FROM 
                tbl_users u
            WHERE 
                u.id = ?
        `;

        database.query(query, [userId], (err, results) => {
            if (err) return callback(err);
            callback(null, results[0]); // Return the first row
        });
    }

    fetchAllPosts(callback) {
        const query = `
            SELECT 
                p.style,
                TIME_FORMAT(p.expiring_on, '%H:%i:%s') AS expiring_time,
                GROUP_CONCAT(pi.image) AS post_images_or_videos
            FROM tbl_posts p
            LEFT JOIN tbl_post_images pi ON p.id = pi.post_id
            GROUP BY p.id, p.description, p.style, p.expiring_on;
        `;

        database.query(query, [], (err, results) => {
            if (err) return callback(err);
            callback(null, results);
        });
    }


    fetchPostsByStyle(style, callback) {
        const query = `
            SELECT 
                p.style,
                TIME_FORMAT(p.expiring_on, '%H:%i:%s') AS expiring_time,
                GROUP_CONCAT(pi.image) AS post_images_or_videos
            FROM tbl_posts p
            LEFT JOIN tbl_post_images pi ON p.id = pi.post_id
            WHERE p.style = ?
            GROUP BY p.style, p.expiring_on;
        `;

        database.query(query, [style], (err, results) => {
            if (err) return callback(err);
            callback(null, results);
        });
    }




    fetchSavedPostsByUserId(user_id, callback) {
        const query = `
            SELECT * 
            FROM tbl_saved_posts 
            WHERE user_id = ? and is_saved = 1 AND is_deleted = 0;
        `;

        database.query(query, [user_id], (err, results) => {
            if (err) return callback(err);
            callback(null, results); // Return all saved posts for the user
        });
    }

    updateUserProfile(username, email, country_code, bio, fullname, user_id, callback) {
        const query = `
            UPDATE tbl_users
            SET 
                username = ?,
                email = ?,
                country_id = (SELECT id FROM tbl_countries WHERE country_code = ?), 
                bio = ?,
                fullname = ?
            WHERE 
                id = ?; 
        `;

        database.query(query, [username, email, country_code, bio, fullname, user_id], (err, result) => {
            if (err) return callback(err);
            callback(null, result); // Return the result of the update operation
        });
    }

    insertBlog(blogData, callback) {
        const query = `
            INSERT INTO blogs (user_id, blog_image, description, title) 
            VALUES (?, ?, ?, ?)
        `;

        const params = [
            blogData.user_id,
            blogData.blog_image,
            blogData.description,
            blogData.title
        ];

        database.query(query, params, (err, result) => {
            if (err) return callback(err);
            callback(null, result); // Return the result of the insert operation
        });
    }

    insertContactUsEntry(contactData, callback) {
        const query = `
            INSERT INTO contect_us (full_name, email, subject, description) 
            VALUES (?, ?, ?, ?)
        `;

        const params = [
            contactData.full_name,
            contactData.email,
            contactData.subject,
            contactData.description
        ];

        database.query(query, params, (err, result) => {
            if (err) return callback(err);
            callback(null, result); // Return the result of the insert operation
        });
    }

    deletePostImages(postId, callback) {
        const query = `
            UPDATE tbl_post_images
        SET is_active = 0, is_deleted = 1
        WHERE post_id = ?;
        `;

        database.query(query, [postId], (err, result) => {
            if (err) return callback(err);
            callback(null, result); // Return the result of the delete operation
        });
    }

    deletePostTags(postId, callback) {
        const query = `
           UPDATE tbl_post_tags
        SET is_active = 0, is_deleted = 1
        WHERE post_id = ?;
        `;

        database.query(query, [postId], (err, result) => {
            if (err) return callback(err);
            callback(null, result); // Return the result of the delete operation
        });
    }

    deletePost(postId, callback) {
        const query = `
           UPDATE tbl_posts
        SET is_active = 0, is_deleted = 1
        WHERE id = ?;
        `;

        database.query(query, [postId], (err, result) => {
            if (err) return callback(err);
            callback(null, result); // Return the result of the delete operation
        });
    }

    logoutUser(userId, callback) {
        const query = `
            UPDATE tbl_users
            SET is_active = 0
            WHERE id = ?;
        `;

        database.query(query, [userId], (err, result) => {
            if (err) return callback(err);
            callback(null, result); // Return the result of the update operation
        });
    }

    softDeleteUserData(userId, callback) {
        // Soft delete user
        const userQuery = `
            UPDATE tbl_users
            SET is_active = 0, is_deleted = 1
            WHERE id = ?;
        `;

        database.query(userQuery, [userId], (err) => {
            if (err) return callback(err);

            // Soft delete related data in other tables
            const queries = [
                `UPDATE tbl_post_images SET is_active = 0, is_deleted = 1 WHERE post_id IN (SELECT id FROM tbl_posts WHERE user_id = ?);`,
                `UPDATE tbl_post_tags SET is_active = 0, is_deleted = 1 WHERE post_id IN (SELECT id FROM tbl_posts WHERE user_id = ?);`,
                `UPDATE tbl_posts SET is_active = 0, is_deleted = 1 WHERE user_id = ?;`,
                `UPDATE tbl_likes SET is_active = 0, is_deleted = 1 WHERE user_id = ?;`,
                `UPDATE tbl_follow SET is_active = 0, is_deleted = 1 WHERE followed_by = ? OR following_to = ?;`,
                `UPDATE tbl_notifications SET is_active = 0, is_deleted = 1 WHERE user_id = ?;`,
                `UPDATE tbl_report_posts SET is_active = 0, is_deleted = 1 WHERE user_id = ?;`,
                `UPDATE tbl_report_profiles SET is_active = 0, is_deleted = 1 WHERE reporter_id = ?;`,
                `UPDATE tbl_messages SET is_active = 0, is_deleted = 1 WHERE user_id1 = ? OR user_id2 = ?;`,
                `UPDATE tbl_saved_posts SET is_active = 0, is_deleted = 1 WHERE user_id = ?;`,
                `UPDATE tbl_saved_ads SET is_active = 0, is_deleted = 1 WHERE post_id IN (SELECT id FROM tbl_posts WHERE user_id = ?);`,
                `UPDATE tbl_post_comments SET is_active = 0, is_deleted = 1 WHERE user_id = ?;`,
                `UPDATE tbl_post_ratings SET is_active = 0, is_deleted = 1 WHERE user_id = ?;`,
                `UPDATE tbl_user_languages SET is_active = 0, is_deleted = 1 WHERE user_id = ?;`,
                `UPDATE tbl_group_users SET is_active = 0, is_deleted = 1 WHERE user_id = ?;`,
                `UPDATE tbl_group_users SET is_active = 0, is_deleted = 1 WHERE user_id = ?;`,
            ];

            // Execute all queries
            let completedQueries = 0;
            queries.forEach((query) => {
                database.query(query, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId], (err) => {
                    if (err) return callback(err);
                    completedQueries++;
                    if (completedQueries === queries.length) {
                        callback(null); // All queries completed successfully
                    }
                });
            });
        });
    }

    fetchTrendingPosts(callback) {
        const query = `
            SELECT 
                p.id AS post_id,
                p.description,
                p.avg_rating,
                p.style,
                GROUP_CONCAT(pi.image) AS post_images_or_videos
            FROM tbl_posts p
            LEFT JOIN tbl_post_images pi ON p.id = pi.post_id
            GROUP BY p.id, p.description, p.avg_rating, p.style
            ORDER BY p.avg_rating DESC;
        `;

        database.query(query, (err, results) => {
            if (err) return callback(err);
            callback(null, results); // Return the results of the query
        });
    }

    fetchNewPosts(style, callback) {
        let query = `
            SELECT 
                p.id AS post_id,
                p.description,
                p.style,
                p.created_at,
                GROUP_CONCAT(pi.image) AS post_images_or_videos
            FROM tbl_posts p
            LEFT JOIN tbl_post_images pi ON p.id = pi.post_id
        `;

        // If a style is provided, filter by that style
        if (style) {
            query += ` WHERE p.style = ?`;
        }

        query += `
            GROUP BY p.id, p.description, p.style, p.created_at
            ORDER BY p.created_at DESC;
        `;

        const params = style ? [style] : []; // Set parameters for the query

        database.query(query, params, (err, results) => {
            if (err) return callback(err);
            callback(null, results); // Return the results of the query
        });
    }

    fetchPostsByFollowingUsers(userId, style, callback) {
        let query = `
            SELECT 
                p.id AS post_id,
                p.description,
                p.style,
                GROUP_CONCAT(pi.image) AS post_images_or_videos
            FROM tbl_posts p
            JOIN tbl_follow f ON p.user_id = f.following_to
            LEFT JOIN tbl_post_images pi ON p.id = pi.post_id
            WHERE f.followed_by = ? AND f.status = 'accepted'
        `;

        // If a style is provided, filter by that style
        if (style) {
            query += ` AND p.style = ?`;
        }

        query += `
            GROUP BY p.id, p.description, p.style;
        `;

        const params = style ? [userId, style] : [userId]; // Set parameters for the query

        database.query(query, params, (err, results) => {
            if (err) return callback(err);
            callback(null, results); // Return the results of the query
        });
    }

    fetchExpiringPosts(style, callback) {
        let query = `
            SELECT 
                p.id AS post_id,
                p.description,
                p.style,
                TIME_FORMAT(p.expiring_on, '%H:%i:%s') AS expiring_time,
                GROUP_CONCAT(pi.image) AS post_images_or_videos
            FROM tbl_posts p
            LEFT JOIN tbl_post_images pi ON p.id = pi.post_id
            WHERE p.expiring_on <= NOW()
        `;

        // If a style is provided, filter by that style
        if (style) {
            query += ` AND p.style = ?`;
        }

        query += `
            GROUP BY p.id, p.description, p.style, p.expiring_on
            ORDER BY p.expiring_on ASC;
        `;

        const params = style ? [style] : []; // Set parameters for the query

        database.query(query, params, (err, results) => {
            if (err) return callback(err);
            callback(null, results); // Return the results of the query
        });
    }

    fetchPostsByCategory(categoryId, callback) {
        const query = `
            SELECT 
                p.style,
                p.style_thumbnail,
                pi.post_id AS post_id,
                p.id AS category_id,
                GROUP_CONCAT(pi.image) AS post_images
            FROM tbl_posts AS p
            JOIN tbl_post_images AS pi ON pi.post_id = p.id
            WHERE p.categories_id = ?
            GROUP BY p.style, p.style_thumbnail, pi.post_id, p.id;
        `;

        database.query(query, [categoryId], (err, results) => {
            if (err) return callback(err);
            callback(null, results); // Return the results of the query
        });
    }
    fetchOtherUserProfile(userId, currentUserId, callback) {
        const query = `
            SELECT 
                u.profile_image,
                u.username,
                u.bio,
                (SELECT COUNT(*) FROM tbl_follow WHERE following_to = u.id AND status = 'accepted') AS total_followers,
                (SELECT COUNT(*) FROM tbl_follow WHERE followed_by = u.id AND status = 'accepted') AS total_following,
                u.total_Retreate,
                u.total_myRatings,
                IFNULL(f.is_follow, 0) AS is_follow  
            FROM 
                tbl_users u
            LEFT JOIN 
                tbl_follow f ON f.following_to = u.id AND f.followed_by = ? AND f.status = 'accepted'  
            WHERE 
                u.id = ?;  
        `;

        database.query(query, [currentUserId, userId], (err, results) => {
            if (err) return callback(err);
            callback(null, results); // Return the results of the query
        });
    }

}


module.exports = new UserModel();