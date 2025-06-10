// middleware/auth.js
const jwt = require('jsonwebtoken');
const { AbilityBuilder, Ability } = require('@casl/ability');

//For google Authentication
const { OAuth2Client } = require('google-auth-library');

//For Defining rules that will be used for roleBased access
function defineAbilitiesFor(user) {
  const { can, cannot, rules } = new AbilityBuilder(Ability);

  if (user.role === 'admin') {
    can('manage', 'all'); // can do anything
  }

  if (user.role === 'instructor') {
    can('read', 'Course');
    can('create', 'Course');
    can('update', 'Course', { instructorId: user.id }); // only own courses
  }

  if (user.role === 'student') {
    can('read', 'Course');
    can('enroll', 'Course');
  }

  return new Ability(rules);
}

function authenticate(req, res, next){
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    req.ability = defineAbilitiesFor(req.user);
    next();
  } catch(e) {
    console.log(e)
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware to verify the token and set req.user
async function googleVerification(req, res, next) {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'Missing idToken' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID, // Must match front-end client ID
    });

    const payload = ticket.getPayload();

    // Optionally, validate `email_verified`, `hd`, etc.
    if (!payload.email_verified) {
      return res.status(401).json({ error: 'Email not verified' });
    }

    // Attach the user info to req.user
    req.google = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    next();
  } catch (err) {
    console.error('Token verification failed', err);
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { googleVerification, authenticate };
