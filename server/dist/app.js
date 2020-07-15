"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const firebase = __importStar(require("firebase"));
const qs = __importStar(require("qs"));
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express_1.default();
const port = process.env.PORT || 8080;
const fb = firebase.initializeApp({
    apiKey: 'AIzaSyDCF3Bl0KvlDjjsnK5i6TLa9NZjCetgBPE',
    authDomain: 'presave-app.firebaseapp.com',
    databaseURL: 'https://presave-app.firebaseio.com',
    projectId: 'presave-app',
    storageBucket: 'presave-app.appspot.com',
    messagingSenderId: '565477002562',
    appId: '1:565477002562:web:6bb7de375ed1a9e1438cdb'
});
const apiVersion = '1.023';
const statsRef = fb.firestore().collection('presaves').doc('--stats--');
const increment = firebase.firestore.FieldValue.increment(1);
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
// Use JSON parser
app.use(express_1.default.json());
app.use(cors());
// Status endpoint
app.get('/', (req, res) => {
    res.status(200);
    res.send(`Login API is running. Version: ${apiVersion}`);
});
// Spotify login endpoint
app.post('/login', async (req, res) => {
    // Get token from Request
    if (req.body.auth_code === undefined) {
        res.status(400);
        res.send('Missing authorization token');
        return;
    }
    try {
        const authCode = req.body.auth_code;
        const tokenData = await getTokenFromAuth(authCode);
        const token = tokenData.access_token;
        // Get user data with token
        const userData = await getUser(token);
        console.log(userData);
        // Check if user has presaved before
        const firstPresave = await checkIfFirstSave(userData.id);
        if (!firstPresave) {
            res.status(200).json({
                success: true,
                message: 'User has presaved before'
            });
            return;
        }
        // Store data in Firestore
        await registerPresave(tokenData, userData);
        res.status(200).json({
            success: true,
            message: 'Presave registered'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error
        });
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
        if (!isFirstSave) {
            return;
        }
        await registerMessengerSave(id, email, firstName, lastName);
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
    res.status(200).json({
        success: true,
        message: 'Token generated',
        token
    });
});
app.post('/apple', async (req, res) => {
    // Get token from Request
    if (req.body.token === undefined) {
        res.status(400);
        res.send('Missing token');
        return;
    }
    // Get locale from token
    const userToken = req.body.token;
    const devToken = createAppleToken();
    try {
        const region = await getLocalization(userToken, devToken);
        await registerApplePresave(userToken, region);
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
// Start listening on defined por
app.listen(port, () => console.log(`🚀 Server listening on port ${port}`));
// Get token and refresh tokens from Spotify with Authorization token
const getTokenFromAuth = async (code) => {
    const endpoint = 'https://accounts.spotify.com/api/token';
    const redirectUrl = process.env.REDIRECT_URL;
    // Encode API credentials
    const credentials = `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`;
    const authorization = Buffer.from(credentials).toString('base64');
    // Create request body
    const requestBody = qs.stringify({
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
        return tokenRes.data;
    }
    catch (error) {
        console.error(error);
        throw new Error(error);
    }
};
// Get user data with token
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
const checkIfFirstSave = async (id) => {
    const userDocsSnap = await fb.firestore().collection('presaves').where('user.id', '==', id).get();
    const size = userDocsSnap.size;
    if (size > 0) {
        return false;
    }
    else {
        return true;
    }
};
// Check if the user has presaved with Messenger
const checkIfFirstMessengerSave = async (id) => {
    const userDocsSnap = await fb.firestore().collection('messengerSaves').where('id', '==', id).get();
    const size = userDocsSnap.size;
    if (size > 0) {
        return false;
    }
    else {
        return true;
    }
};
// Register presave in Firestore
const registerPresave = async (authData, userData) => {
    const docData = {
        authorization: authData,
        user: userData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        hasSaved: false
    };
    const docRef = fb.firestore().collection('presaves').doc();
    const batch = fb.firestore().batch();
    batch.set(docRef, docData);
    batch.set(statsRef, {
        saves: increment,
        spotify: increment
    }, { merge: true });
    return batch.commit();
};
// Register Messenger signup in Firestore
const registerMessengerSave = async (id, email, firstName, lastName) => {
    const docData = {
        id,
        email,
        firstName,
        lastName,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    const docRef = fb.firestore().collection('messengerSaves').doc();
    const batch = fb.firestore().batch();
    batch.set(docRef, docData);
    batch.set(statsRef, {
        saves: increment,
        messenger: increment
    }, { merge: true });
    return batch.commit();
};
// Register Apple Presave in Firestore
const registerApplePresave = async (token, region) => {
    const docData = {
        token,
        region,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    const docRef = fb.firestore().collection('applePresaves').doc();
    const batch = fb.firestore().batch();
    batch.set(docRef, docData);
    batch.set(statsRef, {
        saves: increment,
        apple: increment
    }, { merge: true });
    return batch.commit();
};
// Create signed Apple Developer token
const createAppleToken = () => {
    // Read private Apple Music key
    const keyPath = path_1.default.resolve(__dirname, '../keys', 'apple.key');
    const key = fs_1.default.readFileSync(keyPath);
    // Current UNIX timestamp + UNIX timestamp in 6 months
    const currentTime = Math.floor(Date.now() / 1000);
    const expiryTime = currentTime + 15777000;
    const jwtPayload = {
        iss: '8FCF4L99M8',
        iat: currentTime,
        exp: expiryTime
    };
    const jwtOptions = {
        algorithm: 'ES256',
        keyid: 'MW4F85X63U',
    };
    return jwt.sign(jwtPayload, key, jwtOptions);
};
// Get localization for Apple Music user
const getLocalization = async (userToken, devToken) => {
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
//# sourceMappingURL=app.js.map