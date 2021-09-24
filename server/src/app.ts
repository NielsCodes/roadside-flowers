import { twitterAuthHandler, twitterCallbackHandler } from './controllers/twitter.controller';
import { appleTokenHandler, appleSaveHandler } from './controllers/apple.controller';
import { imageGenerationHandler, imageRetrievalHandler } from './controllers/image.controller';
import express, { Response, Request, Application, NextFunction } from 'express';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import Twitter from 'twitter';
import dayjs from 'dayjs';
import axios from 'axios';
import cors from 'cors';
import fs from 'fs';
import qs from 'qs';

import {createImages, getFileData} from './services/image.service';
import {spotifyPresaveHandler} from './controllers/spotify.controller';

const app: Application = express();
const port = process.env.PORT || 8080;
const apiVersion = '3.2-portfolio';
let twitter: Twitter;

passport.serializeUser( (user, cb) => {
  cb(null, user);
});

passport.deserializeUser( (obj, cb) => {
  cb(null, obj);
});

passport.use(new TwitterStrategy({
  consumerKey: process.env.TWITTER_KEY as string,
  consumerSecret: process.env.TWITTER_SECRET as string,
  callbackURL: `/oauth/callback`,
  passReqToCallback: true
  },
  async (req, token, tokenSecret, profile, callback) => {

    twitter = new Twitter({
      consumer_key: process.env.TWITTER_KEY as string,
      consumer_secret: process.env.TWITTER_SECRET as string,
      access_token_key: token,
      access_token_secret: tokenSecret
    })

    const presaveId = req.session!.dataId;
    const fileData = await getFileData(presaveId);

    twitter.post('media/upload', { media: fileData }, (error: any, media: any, response: any) => {

      if (!error) {
        twitter.post('statuses/update', {
          status: `🌺🌺🌺 I created this @DROELOEMUSIC postcard at https://roadsideflowers.niels.codes, a portfolio project by @NielsCodes`,
          media_ids: media.media_id_string
        }, (tweetError: any, tweet: any, tweetResponse: any) => null);
      } else {
        throw Error(error);
      }

    })

    return callback(null, profile);
  }

))


// Use JSON parser
app.use(express.json());
app.use(cors());
app.use(require('express-session')({ secret: 'a matter of perspective', resave: true, saveUninitialized: true }))
app.use(passport.initialize());
app.use(passport.session());

// Status endpoint
app.get('/', (req: Request, res: Response) => {

  res.status(200);
  res.send(`Presave API is running. Version: ${apiVersion}`);

});

// Spotify login endpoint
app.post('/spotify', spotifyPresaveHandler);

// Get Apple Music developer token
app.get('/apple/token', appleTokenHandler);

// Apple music save endpoint
app.post('/apple', appleSaveHandler);

// Image generation endpoints
app.post('/register', imageGenerationHandler)
app.get('/pictures', imageRetrievalHandler);

// Twitter endpoints
app.get('twitter/auth', twitterAuthHandler, passport.authenticate('twitter'));
app.get('/twitter/callback', passport.authenticate('twitter'), twitterCallbackHandler)

// Start listening on defined port
app.listen(port, () => console.log(`🚀 Server listening on port ${port}`));
