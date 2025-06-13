const express = require('express');
const router = express.Router();
const db = require('../db'); // your better-sqlite3 instance

const { uniqueNamesGenerator, colors, animals } = require('unique-names-generator');

const techAdjectives = [
  'agile', 'async', 'binary', 'cloud', 'compact', 'composable', 'cyber',
  'data-driven', 'digital', 'distributed', 'dynamic', 'encrypted', 'fault-tolerant',
  'headless', 'intelligent', 'lightweight', 'modular', 'neural', 'predictive',
  'quantum', 'real-time', 'responsive', 'scalable', 'secure', 'semantic',
  'serverless', 'smart', 'snappy', 'stateless', 'synthetic', 'virtual', 'zero-trust'
];

const techNouns = [
  'agent', 'api', 'array', 'bot', 'byte', 'circuit', 'cluster', 'component',
  'compiler', 'daemon', 'data', 'dashboard', 'engine', 'endpoint', 'event',
  'firewall', 'function', 'grid', 'hub', 'index', 'interface', 'kernel', 'lambda',
  'loop', 'matrix', 'model', 'module', 'node', 'pipeline', 'port', 'protocol',
  'query', 'repo', 'script', 'service', 'socket', 'stack', 'stream', 'switch',
  'thread', 'token', 'vector', 'vm', 'widget'
];

function chunkArray(array, size) {
  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

// Get all peer groups
router.get('/', (req, res) => {
  try {
    // Fetch all groups with leader info
    const groups = db.prepare(`
      SELECT
        pg.id AS group_id,
        pg.name AS group_name,
        p.id AS leader_id,
        p.fullname AS leader_name,
        u.email AS leader_email
      FROM peer_groups pg JOIN users u on u.id = pg.leader_id
      LEFT JOIN student_profiles p ON pg.leader_id = p.id
    `).all();

    // Fetch all members with group relation
    const members = db.prepare(`
      SELECT
        pgm.group_id,
        u.id AS user_id,
        p.fullname,
        u.email
      FROM peer_group_members pgm
      JOIN users u ON pgm.user_id = u.id
      JOIN student_profiles p ON pgm.user_id = p.id
    `).all();

    // Combine leader and members per group
    const result = groups.map(group => {
      const groupMembers = members
        .filter(m => m.group_id === group.group_id)
        .map(({ fullname, email }) => ({ fullname, email }));

      return {
        id: group.group_id,
        name: group.group_name,
        leader: {
          name: group.leader_name,
          email: group.leader_email
        },
        members: groupMembers
      };
    });

    res.status(200).json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving peer groups' });
  }
});

// Get user peer group
router.get('/me', (req, res) => {
  try {
    const usergroup = db.prepare(`
      SELECT
        pg.group_id as group_id
      FROM peer_group_members pg WHERE pg.user_id = ?
    `).get(req.user.id);

    // Fetch all groupleader for user group
    const groups = db.prepare(`
      SELECT
        pg.id AS group_id,
        pg.name AS group_name,
        p.id AS leader_id,
        p.fullname AS leader_name,
        u.email AS leader_email
      FROM peer_groups pg JOIN users u on u.id = pg.leader_id
      LEFT JOIN student_profiles p ON pg.leader_id = p.id WHERE pg.id = ?
    `).all(usergroup.group_id);

    // Fetch all members with group relation
    const members = db.prepare(`
      SELECT
        pgm.group_id,
        u.id AS user_id,
        p.fullname,
        u.email
      FROM peer_group_members pgm
      JOIN users u ON pgm.user_id = u.id
      JOIN student_profiles p ON pgm.user_id = p.id WHERE pgm.group_id = ?
    `).all(usergroup.group_id);

      console.log(members)

    // Combine leader and members per group
    const result = groups.map(group => {
      const groupMembers = members
        .filter(m => m.group_id === group.group_id)
        .map(({ fullname, email }) => ({ fullname, email }));

      return {
        id: group.group_id,
        name: group.group_name,
        leader: {
          name: group.leader_name,
          email: group.leader_email
        },
        members: groupMembers
      };
    });


    res.status(200).json(...result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving peer groups' });
  }
});


// Get peer groups based on ID
router.get('/:id', (req, res) => {
    const { id } = req.params
  try {
    // Fetch all groups with leader info
    const groups = db.prepare(`
      SELECT
        pg.id AS group_id,
        pg.name AS group_name,
        p.id AS leader_id,
        p.fullname AS leader_name,
        u.email AS leader_email
      FROM peer_groups pg JOIN users u on u.id = pg.leader_id
      LEFT JOIN student_profiles p ON pg.leader_id = p.id
    `).all();

    // Fetch all members with group relation
    const members = db.prepare(`
      SELECT
        pgm.group_id,
        u.id AS user_id,
        p.fullname,
        u.email
      FROM peer_group_members pgm
      JOIN users u ON pgm.user_id = u.id
      JOIN student_profiles p ON pgm.user_id = p.id
    `).all();

    // Combine leader and members per group
    const result = groups.map(group => {
      const groupMembers = members
        .filter(m => m.group_id === group.group_id)
        .map(({ fullname, email }) => ({ fullname, email }));

      return {
        id: group.group_id,
        name: group.group_name,
        leader: {
          name: group.leader_name,
          email: group.leader_email
        },
        members: groupMembers
      };
    });

      const data = result.filter((value) => value.id == id)

    res.status(200).json(...data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving peer groups' });
  }
});

//Automatically Assign Group...
router.post('/', (req, res) => {
  try {
    const ungroupedUsers = db.prepare(`
      SELECT u.id, p.fullname, u.email FROM users u JOIN student_profiles p on u.id=p.id
      WHERE u.id NOT IN (
        SELECT user_id FROM peer_group_members
      )
    `).all();

    if (ungroupedUsers.length < 4) {
      return res.status(200).json({ message: 'Not enough users to form a new group.' });
    }

    const chunks = chunkArray(ungroupedUsers, 4);

    const insertGroup = db.prepare(`INSERT INTO peer_groups (name, leader_id) VALUES (?, ?)`);
    const insertMember = db.prepare(`INSERT INTO peer_group_members (user_id, group_id) VALUES (?, ?)`);

    const transaction = db.transaction(() => {
      const createdGroups = [];

      chunks.forEach((groupUsers, idx) => {
        if (groupUsers.length < 4) return; // optional: skip if group < 4

        const leaderId = groupUsers[0].id;
        const groupName = uniqueNamesGenerator({
          dictionaries: [techAdjectives, techNouns],
          separator: '-',
          style: 'capital',
        });

        const groupResult = insertGroup.run(groupName, leaderId);
        const groupId = groupResult.lastInsertRowid;

        groupUsers.forEach(user => {
          insertMember.run(user.id, groupId);
        });

        createdGroups.push({ id: groupId, name: groupName });
      });

      return createdGroups;
    });

    const groups = transaction();
    res.status(201).json({ message: 'New groups formed', groups });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error grouping users' });
  }
});

module.exports = router;

