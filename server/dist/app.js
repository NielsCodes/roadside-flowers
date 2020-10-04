"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const canvas_1 = require("canvas");
const passport_twitter_1 = require("passport-twitter");
const advancedFormat_1 = __importDefault(require("dayjs/plugin/advancedFormat"));
const storage_1 = require("@google-cloud/storage");
const canvas_multiline_text_1 = __importDefault(require("canvas-multiline-text"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const twitter_1 = __importDefault(require("twitter"));
const dayjs_1 = __importDefault(require("dayjs"));
const axios_1 = __importDefault(require("axios"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const qs_1 = __importDefault(require("qs"));
const storage = new storage_1.Storage();
const app = express_1.default();
const port = process.env.PORT || 8080;
const apiVersion = '3.001';
let bucket;
let twitter;
dayjs_1.default.extend(advancedFormat_1.default);
if (process.env.ENV !== 'prod' && process.env.ENV !== 'dev') {
    require('dotenv').config();
    const serviceAccount = require('../keys/presave-app-dev-firebase-adminsdk-7jzfy-7159a5d47a.json');
    firebase_admin_1.default.initializeApp({
        credential: firebase_admin_1.default.credential.cert(serviceAccount),
        databaseURL: 'https://presave-app-dev.firebaseio.com'
    });
}
else {
    firebase_admin_1.default.initializeApp();
}
if (process.env.ENV === 'prod') {
    bucket = storage.bucket('bitbird-presave-bucket');
}
else {
    bucket = storage.bucket('bitbird-presave-dev-bucket');
}
passport_1.default.serializeUser((user, cb) => {
    cb(null, user);
});
passport_1.default.deserializeUser((obj, cb) => {
    cb(null, obj);
});
passport_1.default.use(new passport_twitter_1.Strategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: `/oauth/callback`,
    passReqToCallback: true
}, async (req, token, tokenSecret, profile, callback) => {
    twitter = new twitter_1.default({
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        access_token_key: token,
        access_token_secret: tokenSecret
    });
    const fileDownload = await bucket.file(`tickets/${req.session.dataId}/DROELOE-ticket-horizontal.jpg`).download();
    const fileData = fileDownload[0];
    twitter.post('media/upload', { media: fileData }, (error, media, response) => {
        if (!error) {
            twitter.post('statuses/update', { status: `🌺🌺🌺 @DROELOEMUSIC @bitbird https://presave.droeloe.com`, media_ids: media.media_id_string }, (tweetError, tweet, tweetResponse) => null);
        }
        else {
            throw Error(error);
        }
    });
    return callback(null, profile);
}));
const statsRef = firebase_admin_1.default.firestore().collection('config').doc('--stats--');
const increment = firebase_admin_1.default.firestore.FieldValue.increment(1);
// Use JSON parser
app.use(express_1.default.json());
app.use(cors_1.default());
app.use(require('express-session')({ secret: 'a matter of perspective', resave: true, saveUninitialized: true }));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Status endpoint
app.get('/', (req, res) => {
    res.status(200);
    res.send(`Presave API is running. Version: ${apiVersion}`);
});
// Spotify login endpoint
app.post('/spotify', async (req, res) => {
    var _a;
    // Get token from Request
    if (req.body.auth_code === undefined) {
        res.status(400);
        const msg = 'Invalid request: missing authorization token';
        console.error(msg);
        res.send(msg);
        return;
    }
    const dataId = req.body.dataId;
    try {
        const authCode = req.body.auth_code;
        const tokenResult = await getSpotifyTokenFromAuth(authCode);
        // If Token retrieval fails, check if this is due to reuse of auth token or not
        if (tokenResult.success === false) {
            // If token retrieval failed, check if value already in Firestore
            const authCodefirstUse = await checkSpotifyAuthCodeFirstUse(authCode);
            if (authCodefirstUse === true) {
                // Auth code was not used before but still failed to retrieve tokens
                res
                    .status(400)
                    .json({
                    success: false,
                    message: 'Could not receive Spotify tokens with auth code'
                })
                    .send();
                throw Error(`Could not receive Spotify tokens with auth code: ${authCode}`);
            }
            else {
                // Auth code was used before. Likely due to page refresh
                res
                    .status(200)
                    .json({
                    success: true,
                    message: 'Auth token reused. Presave successful'
                })
                    .send();
                return;
            }
        }
        // tslint:disable-next-line: no-non-null-assertion
        const token = (_a = tokenResult.data) === null || _a === void 0 ? void 0 : _a.access_token;
        // Get user data with token
        const userData = await getUser(token);
        // Check if user has presaved before
        const firstPresave = await checkIfFirstSpotifySave(userData.id);
        if (!firstPresave) {
            await registerAuthCodeForExistingSpotifyPresave(userData.id, authCode);
            await registerDataIdForExistingSpotifyPresave(userData.id, dataId);
            res
                .status(200)
                .json({
                success: true,
                message: 'User has presaved before'
            })
                .send();
            return;
        }
        // Store data in Firestore
        // tslint:disable-next-line: no-non-null-assertion
        await registerSpotifyPresave(tokenResult.data, userData, authCode, dataId);
        res
            .status(200)
            .json({
            success: true,
            message: 'Presave registered'
        })
            .send();
    }
    catch (error) {
        console.error(error);
        res
            .status(500)
            .json({
            success: false,
            message: error
        })
            .send();
        throw Error(error);
    }
});
// Messenger presave from Zapier
app.post('/zapier', async (req, res) => {
    console.log(req.body);
    const id = req.body.id;
    if (id === undefined) {
        res.status(400).json({
            success: false,
            message: 'No ID found'
        });
        console.error(`Retrieved call without ID`);
        return;
    }
    const email = req.body.email || 'undefined';
    const firstName = req.body.firstName || 'undefined';
    const lastName = req.body.lastName || 'undefined';
    try {
        const isFirstSave = await checkIfFirstMessengerSave(id);
        if (isFirstSave) {
            await registerMessengerSave(id, email, firstName, lastName);
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error
        });
        return;
    }
    res.status(200).json({
        success: true,
        message: 'Messenger save registered successfully'
    });
});
// Get Apple Music developer token
app.get('/devtoken', async (req, res) => {
    const token = createAppleToken();
    if (token === null) {
        const msg = 'Error creating Apple token. No environment variable';
        res
            .status(503)
            .json({
            success: false,
            message: msg
        })
            .send();
        console.error(msg);
    }
    res.status(200).json({
        success: true,
        message: 'Token generated. Development...',
        token
    });
});
app.post('/apple', async (req, res) => {
    // Get token from Request
    if (req.body.token === undefined) {
        res.status(400);
        const msg = 'Invalid request: Missing User token';
        console.error(msg);
        res.send(msg);
        return;
    }
    const dataId = req.body.dataId;
    // Get locale from token
    const userToken = req.body.token;
    const devToken = createAppleToken();
    if (devToken === null) {
        console.error('Received null Apple Developer token');
        res
            .status(500)
            .json({
            success: false,
            message: 'Failed to authenticate'
        })
            .send();
        return;
    }
    try {
        const region = await getAppleLocalization(userToken, devToken);
        await registerApplePresave(userToken, region, dataId);
        res.status(200);
        res.json({
            success: true,
            message: 'Saved Apple presave successfully'
        });
    }
    catch (error) {
        res.status(500);
        res.send('Something went wrong');
        console.error(error);
        throw new Error(error);
    }
});
app.get('/status', async (req, res) => {
    const key = req.headers.key;
    if (key !== process.env.STATUS_KEY) {
        res
            .status(401)
            .send();
        return;
    }
    const doc = await statsRef.get();
    const stats = doc.data();
    res
        .status(200)
        .json({
        success: true,
        stats
    })
        .send();
});
app.post('/register', async (req, res) => {
    if (req.body === undefined) {
        res
            .status(400)
            .json({
            success: false,
            message: 'No request body passed'
        })
            .send()
            .end();
        console.error('Received request without body');
        return;
    }
    const fromName = req.body.fromName;
    const toName = req.body.toName;
    const message = req.body.message;
    const id = req.body.id;
    const params = [fromName, toName, message, id];
    if (params.includes(undefined)) {
        res
            .status(400)
            .json({
            success: false,
            message: `Missing request body item. Make sure you pass 'fromName', 'toName', 'message' and 'id'`
        })
            .send()
            .end();
        console.error(`Received request with missing parameter. ${JSON.stringify(params)}`);
        return;
    }
    // Log in Firestore
    const docRef = firebase_admin_1.default.firestore().collection('pictureData').doc();
    await docRef.create({
        fromName,
        toName,
        message,
        id,
        createdAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
    });
    // Create tickets
    // tslint:disable-next-line: max-line-length
    const promises = [createVerticalImage(fromName, toName, message, id), createHorizontalImage(fromName, toName, message, id)];
    await statsRef.set({
        picturesGenerated: increment
    }, { merge: true });
    await Promise.all(promises);
    res
        .status(200)
        .json({
        success: true,
        message: `Pictures generated with ID ${id}`
    })
        .send();
});
app.get('/pictures', async (req, res) => {
    const id = req.query.id;
    if (id === undefined || id === null || id === '') {
        res
            .status(400)
            .json({
            success: false,
            message: 'No data ID passed'
        })
            .send();
        return;
    }
    try {
        const urls = await getSignedURLs(id);
        res
            .status(200)
            .json({
            success: true,
            urls
        })
            .send();
    }
    catch (error) {
        res
            .status(500)
            .json({
            success: false,
            message: 'Unknown error occured while getting signed URLs'
        })
            .send();
    }
});
app.post('/newsletter', async (req, res) => {
    const dataId = req.body.dataId;
    if (dataId === undefined) {
        res
            .status(400)
            .json({
            success: false,
            message: `Missing data ID body item. Make sure you pass 'dataId'`
        })
            .send()
            .end();
        return;
    }
    let email;
    try {
        email = await getEmailFromDataId(dataId);
    }
    catch (error) {
        res
            .status(404)
            .json({
            success: false,
            message: `No valid email address available for this presave ID'`
        })
            .send()
            .end();
        return;
    }
    try {
        await subscribeToNewsletter(email);
        res
            .status(200)
            .json({
            success: true,
            message: 'Successfully added email address to Klaviyo list'
        })
            .send()
            .end();
        return;
    }
    catch (error) {
        res
            .status(500)
            .json({
            success: false,
            message: 'Encountered an error while adding the email address to Klaviyo'
        })
            .send()
            .end();
        throw Error(`Encounted an error while adding email address ${email} to Klaviyo. ${error.toString()}`);
    }
});
app.get('/auth/twitter', (req, res, next) => {
    /**
     * req.query gets overwritten by OAuth
     * Passing data ID to req.sessions enables retrieval in Passport auth callback
     */
    req.session.dataId = req.query.dataId;
    next();
}, passport_1.default.authenticate('twitter'));
app.get('/oauth/callback', passport_1.default.authenticate('twitter'), (req, res) => {
    res.send('<script>window.close()</script>');
});
app.post('/test', async (req, res) => {
    if (req.body === undefined) {
        res
            .status(400)
            .json({
            success: false,
            message: 'No request body passed'
        })
            .send()
            .end();
        console.error('Received request without body');
        return;
    }
    const fromName = req.body.fromName;
    const toName = req.body.toName;
    const message = req.body.message;
    const id = req.body.id;
    const params = [fromName, toName, message, id];
    if (params.includes(undefined)) {
        res
            .status(400)
            .json({
            success: false,
            message: `Missing request body item. Make sure you pass 'fromName', 'toName', 'message' and 'id'`
        })
            .send()
            .end();
        console.error(`Received request with missing parameter. ${JSON.stringify(params)}`);
        return;
    }
    // Create tickets
    // tslint:disable-next-line: max-line-length
    const promises = [createVerticalImage(fromName, toName, message, id)];
    // await statsRef.set({
    //   picturesGenerated: increment
    // }, { merge: true });
    await Promise.all(promises);
    res
        .status(200)
        .json({
        success: true,
        message: `Pictures generated with ID ${id}`
    })
        .send();
});
// Start listening on defined port
app.listen(port, () => console.log(`🚀 Server listening on port ${port}`));
/**
 * Get token and refresh tokens from Spotify with Authorization token
 * @param code Authentication token to verify user with
 * @returns Object with user token, refresh token and scope
 */
const getSpotifyTokenFromAuth = async (code) => {
    const output = {
        success: false
    };
    const endpoint = 'https://accounts.spotify.com/api/token';
    const redirectUrl = process.env.REDIRECT_URL;
    // Encode API credentials
    const credentials = `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`;
    const authorization = Buffer.from(credentials).toString('base64');
    // Create request body
    const requestBody = qs_1.default.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUrl
    });
    // Try calling the Spotify API
    try {
        const tokenRes = await axios_1.default.post(endpoint, requestBody, {
            headers: {
                Authorization: `Basic ${authorization}`
            }
        });
        output.success = true;
        output.data = tokenRes.data;
        return output;
    }
    catch (error) {
        if (error.response.status === 400) {
            console.log('Invalid client error');
        }
        else {
            console.error(error);
        }
        output.error = error;
        return output;
    }
};
/**
 * Get user data with token
 * @param token Spotify auth token
 */
const getUser = async (token) => {
    const endpoint = 'https://api.spotify.com/v1/me';
    try {
        const userRes = await axios_1.default.get(endpoint, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return userRes.data;
    }
    catch (error) {
        console.error(error);
        throw new Error(error);
    }
};
// Check if the user has presaved
const checkIfFirstSpotifySave = async (id) => {
    const userDocsSnap = await firebase_admin_1.default.firestore().collection('spotifyPresaves').where('user.id', '==', id).get();
    const size = userDocsSnap.size;
    if (size > 0) {
        return false;
    }
    else {
        return true;
    }
};
// Check if auth token was already used
const checkSpotifyAuthCodeFirstUse = async (authCode) => {
    const authCodeSnap = await firebase_admin_1.default.firestore().collection('spotifyPresaves').where('authCodes', 'array-contains', authCode).get();
    const size = authCodeSnap.size;
    if (size > 0) {
        return false;
    }
    else {
        return true;
    }
};
// Check if the user has presaved with Messenger
const checkIfFirstMessengerSave = async (id) => {
    const userDocsSnap = await firebase_admin_1.default.firestore().collection('messengerSaves').where('id', '==', id).get();
    const size = userDocsSnap.size;
    if (size > 0) {
        return false;
    }
    else {
        return true;
    }
};
// Register presave in Firestore
const registerSpotifyPresave = async (authData, userData, authCode, dataId = '') => {
    const docData = {
        authorization: authData,
        user: userData,
        timestamp: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
        hasSaved: false,
        authCodes: [authCode],
        dataIds: [dataId]
    };
    const docRef = firebase_admin_1.default.firestore().collection('spotifyPresaves').doc();
    const batch = firebase_admin_1.default.firestore().batch();
    batch.set(docRef, docData);
    batch.set(statsRef, {
        saves: increment,
        spotify: increment
    }, { merge: true });
    return batch.commit();
};
/** Add auth code to an existing presave */
const registerAuthCodeForExistingSpotifyPresave = async (id, authCode) => {
    const presaveDocsSnap = await firebase_admin_1.default.firestore().collection('spotifyPresaves').where('user.id', '==', id).get();
    const docId = presaveDocsSnap.docs[0].id;
    await firebase_admin_1.default.firestore().collection('spotifyPresaves').doc(docId).set({
        authCodes: firebase_admin_1.default.firestore.FieldValue.arrayUnion(authCode)
    }, { merge: true });
};
/** Add data ID code to an existing presave */
const registerDataIdForExistingSpotifyPresave = async (id, dataId) => {
    const presaveDocsSnap = await firebase_admin_1.default.firestore().collection('spotifyPresaves').where('user.id', '==', id).get();
    const docId = presaveDocsSnap.docs[0].id;
    await firebase_admin_1.default.firestore().collection('spotifyPresaves').doc(docId).set({
        dataIds: firebase_admin_1.default.firestore.FieldValue.arrayUnion(dataId)
    }, { merge: true });
};
// Register Messenger signup in Firestore
const registerMessengerSave = async (id, email, firstName, lastName) => {
    const docData = {
        id,
        email,
        firstName,
        lastName,
        timestamp: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
    };
    const docRef = firebase_admin_1.default.firestore().collection('messengerSaves').doc();
    const batch = firebase_admin_1.default.firestore().batch();
    batch.set(docRef, docData);
    batch.set(statsRef, {
        saves: increment,
        messenger: increment
    }, { merge: true });
    return batch.commit();
};
// Register Apple Presave in Firestore
const registerApplePresave = async (token, region, dataId = '') => {
    const docData = {
        token,
        region,
        timestamp: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
        hasSaved: false,
        dataId
    };
    const docRef = firebase_admin_1.default.firestore().collection('applePresaves').doc();
    const batch = firebase_admin_1.default.firestore().batch();
    batch.set(docRef, docData);
    batch.set(statsRef, {
        saves: increment,
        apple: increment
    }, { merge: true });
    return batch.commit();
};
/**
 * Create signed Apple Developer token
 * @returns Signed token
 */
const createAppleToken = () => {
    // Read private Apple Music key
    const privateKey = process.env.APPLE_PRIVATE_KEY;
    if (privateKey === undefined || privateKey === null) {
        return null;
    }
    const key = privateKey.replace(/\\n/gm, '\n');
    // Current UNIX timestamp + UNIX timestamp in 6 months
    const currentTime = Math.floor(Date.now() / 1000);
    const expiryTime = currentTime + 15777000;
    const jwtPayload = {
        iss: '8FCF4L99M8',
        iat: currentTime,
        exp: expiryTime
    };
    return jsonwebtoken_1.default.sign(jwtPayload, key, { algorithm: 'ES256', keyid: '2XNHW5P3K5' });
};
// Get localization for Apple Music user
const getAppleLocalization = async (userToken, devToken) => {
    const endpoint = 'https://api.music.apple.com/v1/me/storefront';
    try {
        const res = await axios_1.default.get(endpoint, {
            headers: {
                Authorization: `Bearer ${devToken}`,
                'Music-User-Token': userToken
            }
        });
        return res.data.data[0].id;
    }
    catch (error) {
        throw new Error(error);
    }
};
/**
 * Create a vertical picture with user defined variables
 *
 * Creates canvas with background image with variables overlaid
 *
 * Uploads the file to Google Cloud Storage and retrieves a signed URL for download
 *
 * @param fromName UGC: 'From' name
 * @param toName UGC: 'To' name
 * @param message UGC: 'Message'
 * @param id ID to link to front-end
 */
const createVerticalImage = async (fromName, toName, message, id) => {
    canvas_1.registerFont(`./assets/ernie.ttf`, { family: 'Ernie' });
    const canvas = canvas_1.createCanvas(1080, 1929);
    const ctx = canvas.getContext('2d');
    const picture = await canvas_1.loadImage('./assets/picture-vertical.jpg');
    ctx.drawImage(picture, 0, 0);
    ctx.font = '48px Ernie';
    ctx.textBaseline = 'top';
    // DRAW 'TO' NAME
    ctx.save();
    ctx.rotate(-10 * Math.PI / 180);
    ctx.fillText(`TO: ${toName}`, 130, 300);
    ctx.restore();
    // DRAW 'FROM' NAME
    ctx.save();
    ctx.rotate(-1 * Math.PI / 180);
    ctx.fillText(`FROM: ${fromName}`, 425, 1180);
    ctx.restore();
    // DRAW DATE
    const currentDate = getDate();
    ctx.save();
    ctx.rotate(-1 * Math.PI / 180);
    ctx.fillText(currentDate, 670, 1480);
    ctx.restore();
    // DRAW MESSAGE
    ctx.save();
    ctx.rotate(-12 * Math.PI / 180);
    canvas_multiline_text_1.default(ctx, message, {
        rect: {
            x: 30,
            y: 400,
            width: 700,
            height: 600
        },
        font: 'Ernie',
        lineHeight: 1.4,
        minFontSize: 48,
        maxFontSize: 48
    });
    const buffer = canvas.toBuffer('image/jpeg');
    const filename = `./output/vert-${id}.jpg`;
    fs_1.default.writeFileSync(filename, buffer);
    const res = await bucket.upload(filename, {
        destination: `pictures/${id}/DROELOE-picture-vertical.jpg`
    });
    fs_1.default.unlinkSync(filename);
    return;
};
/**
 * Create a horizontal picture with user defined variables
 *
 * Creates canvas with background image with variables overlaid
 *
 * Uploads the file to Google Cloud Storage and retrieves a signed URL for download
 *
 * @param fromName UGC: 'From' name
 * @param toName UGC: 'To' name
 * @param message UGC: 'Message'
 * @param id ID to link to front-end
 */
const createHorizontalImage = async (fromName, toName, message, id) => {
    canvas_1.registerFont(`./assets/ernie.ttf`, { family: 'Ernie' });
    const canvas = canvas_1.createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d');
    const picture = await canvas_1.loadImage('./assets/picture-horizontal.jpg');
    ctx.drawImage(picture, 0, 0);
    ctx.font = '48px Ernie';
    ctx.textBaseline = 'top';
    // DRAW 'TO' NAME
    ctx.save();
    ctx.rotate(-11 * Math.PI / 180);
    ctx.fillText(`TO: ${toName}`, 262, 200, 200);
    ctx.restore();
    // DRAW 'FROM' NAME
    ctx.save();
    ctx.rotate(-1 * Math.PI / 180);
    ctx.fillText(`FROM: ${fromName}`, 1276, 662);
    ctx.restore();
    // DRAW DATE
    const currentDate = getDate();
    ctx.save();
    ctx.rotate(-1 * Math.PI / 180);
    ctx.fillText(currentDate, 1500, 980);
    ctx.restore();
    // DRAW MESSAGE
    ctx.save();
    ctx.rotate(-8 * Math.PI / 180);
    canvas_multiline_text_1.default(ctx, message, {
        rect: {
            x: 100,
            y: 300,
            width: 1000,
            height: 400
        },
        font: 'Ernie',
        lineHeight: 1.4,
        minFontSize: 48,
        maxFontSize: 48
    });
    const buffer = canvas.toBuffer('image/jpeg');
    const filename = `./output/hor-${id}.jpg`;
    fs_1.default.writeFileSync(filename, buffer);
    const res = await bucket.upload(filename, {
        destination: `pictures/${id}/DROELOE-picture-horizontal.jpg`
    });
    fs_1.default.unlinkSync(filename);
    return;
};
/**
 * Get signed URLs for all files from the given data ID
 * @param id ID that is used to connect to right user
 */
const getSignedURLs = async (id) => {
    const expiration = Date.now() + 604800;
    const urls = {};
    try {
        const [files] = await bucket.getFiles({ prefix: `pictures/${id}` });
        if (files.length !== 2) {
            throw Error(`Unable to find pictures with ID: ${id}`);
        }
        for (const file of files) {
            const [signedURL] = await file.getSignedUrl({
                action: 'read',
                expires: expiration,
                version: 'v4',
            });
            if (file.name.includes('vertical')) {
                urls.vertical = signedURL;
            }
            else {
                urls.horizontal = signedURL;
            }
        }
        ;
        return urls;
    }
    catch (error) {
        console.error(error);
        throw Error(error);
    }
};
/**
 * Get date string in 'MMMM Do' format
 * @example 'October 1st'
 */
const getDate = () => {
    return dayjs_1.default().format('MMMM Do');
};
/**
 * Retrieve the email address of a Spotify account by the presave's data ID
 * @param dataId UUID to connect frontend presave to backend
 */
const getEmailFromDataId = async (dataId) => {
    const presaveDocsSnap = await firebase_admin_1.default.firestore().collection('spotifyPresaves').where('dataIds', 'array-contains', dataId).get();
    if (presaveDocsSnap.size === 0) {
        throw Error('No presave with this data ID');
    }
    const docData = presaveDocsSnap.docs[0].data();
    const email = docData.user.email;
    if (email === undefined || email === '') {
        throw Error('No valid email address available for this account');
    }
    return email;
};
/**
 * Add an email address to Klaviyo
 * @param email User's Spotify email address. May not be valid
 */
const subscribeToNewsletter = async (email) => {
    const listId = 'SxG2iS';
    const endpoint = `https://a.klaviyo.com/api/v2/list/${listId}/subscribe`;
    return await axios_1.default.post(endpoint, {
        "api_key": process.env.KLAVIYO_KEY,
        profiles: [
            {
                email
            }
        ]
    });
};
//# sourceMappingURL=app.js.map