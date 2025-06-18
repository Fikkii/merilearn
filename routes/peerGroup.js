const express = require('express');
const router = express.Router();
const pool = require('../db');

const checkEnrollment = require('../middleware/enroll')

//Make sure the user is enrolled
router.use(checkEnrollment)

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
router.get('/', async (req, res) => {
  try {
    // Fetch peer groups with leader info
    const [groups] = await pool.execute(`
      SELECT
        pg.id AS group_id,
        pg.name AS group_name,
        p.id AS leader_id,
        p.fullname AS leader_name,
        u.email AS leader_email
      FROM peer_groups pg
      JOIN users u ON u.id = pg.leader_id
      LEFT JOIN student_profiles p ON pg.leader_id = p.id
    `);

    // Fetch all group members
    const [members] = await pool.execute(`
      SELECT
        pgm.group_id,
        u.id AS user_id,
        p.fullname,
        u.email
      FROM peer_group_members pgm
      JOIN users u ON pgm.user_id = u.id
      JOIN student_profiles p ON pgm.user_id = p.id
    `);

    // Map results
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
    console.error('Failed to fetch peer groups:', err);
    res.status(500).json({ message: 'Error retrieving peer groups' });
  }
});

// Get user peer group
router.get('/me', async (req, res) => {
  try {
    // Step 1: Get the group_id the current user belongs to
    const [groupRow] = await pool.execute(`
      SELECT pg.group_id AS group_id
      FROM peer_group_members pg
      WHERE pg.user_id = ?
      LIMIT 1
    `, [req.user.id]);

    if (!groupRow.length) {
      return res.status(404).json({ message: 'User is not in any peer group' });
    }

    const groupId = groupRow[0].group_id;

    // Step 2: Get group and leader details
    const [groups] = await pool.execute(`
      SELECT
        pg.id AS group_id,
        pg.name AS group_name,
        p.id AS leader_id,
        p.fullname AS leader_name,
        u.email AS leader_email
      FROM peer_groups pg
      JOIN users u ON u.id = pg.leader_id
      LEFT JOIN student_profiles p ON pg.leader_id = p.id
      WHERE pg.id = ?
    `, [groupId]);

    // Step 3: Get group members
    const [members] = await pool.execute(`
      SELECT
        pgm.group_id,
        u.id AS user_id,
        p.fullname,
        u.email
      FROM peer_group_members pgm
      JOIN users u ON pgm.user_id = u.id
      JOIN student_profiles p ON pgm.user_id = p.id
      WHERE pgm.group_id = ?
    `, [groupId]);

    // Step 4: Combine leader and members
    const result = groups.map(group => {
      const groupMembers = members.map(({ fullname, email }) => ({ fullname, email }));

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

    res.status(200).json(result[0]); // Only one group for /me

  } catch (err) {
    console.error('Failed to fetch peer group for user:', err);
    res.status(500).json({ message: 'Error retrieving peer group' });
  }
});

// Get peer groups based on ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch group with leader info
    const [groups] = await pool.execute(`
      SELECT
        pg.id AS group_id,
        pg.name AS group_name,
        p.id AS leader_id,
        p.fullname AS leader_name,
        u.email AS leader_email
      FROM peer_groups pg
      JOIN users u ON u.id = pg.leader_id
      LEFT JOIN student_profiles p ON pg.leader_id = p.id
      WHERE pg.id = ?
    `, [id]);

    if (!groups.length) {
      return res.status(404).json({ message: 'Peer group not found' });
    }

    // Fetch members of the group
    const [members] = await pool.execute(`
      SELECT
        pgm.group_id,
        u.id AS user_id,
        p.fullname,
        u.email
      FROM peer_group_members pgm
      JOIN users u ON pgm.user_id = u.id
      JOIN student_profiles p ON pgm.user_id = p.id
      WHERE pgm.group_id = ?
    `, [id]);

    const group = groups[0];

    const result = {
      id: group.group_id,
      name: group.group_name,
      leader: {
        name: group.leader_name,
        email: group.leader_email
      },
      members: members.map(({ fullname, email }) => ({ fullname, email }))
    };

    res.status(200).json(result);

  } catch (err) {
    console.error('Error retrieving peer group:', err);
    res.status(500).json({ message: 'Error retrieving peer group' });
  }
});

//Automatically Assign Group...
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();

    const groupsize = 4

  try {
    // Step 1: Get users belonging to same learning track but not yet in any group
    const [ungroupedUsers] = await conn.execute(`
      SELECT u.id, p.fullname, u.email
      FROM users u
      JOIN student_profiles p ON u.id = p.id
      JOIN enrollments e ON u.id = e.student_id
      WHERE e.course_id = ? AND u.id NOT IN (
        SELECT user_id FROM peer_group_members
      )
    `, [req.user.course_id]);

    if (ungroupedUsers.length < groupsize) {
      return res.status(200).json({ message: 'Not enough users to form a new group.' });
    }

    const chunks = chunkArray(ungroupedUsers, groupsize);
    const createdGroups = [];

    await conn.beginTransaction();

    for (const groupUsers of chunks) {
      if (groupUsers.length < groupsize) continue; // Optionally skip groups with fewer than 4

      const leaderId = groupUsers[0].id;
      const groupName = uniqueNamesGenerator({
        dictionaries: [techAdjectives, techNouns],
        separator: '-',
        style: 'capital',
      });

      const [groupResult] = await conn.execute(
        `INSERT INTO peer_groups (name, leader_id) VALUES (?, ?)`,
        [groupName, leaderId]
      );

      const groupId = groupResult.insertId;

      for (const user of groupUsers) {
        await conn.execute(
          `INSERT INTO peer_group_members (user_id, group_id) VALUES (?, ?)`,
          [user.id, groupId]
        );
      }

      createdGroups.push({ id: groupId, name: groupName });
    }

    await conn.commit();
    res.status(201).json({ message: 'New groups formed', groups: createdGroups });

  } catch (err) {
    await conn.rollback();
    console.error('Error grouping users:', err);
    res.status(500).json({ message: 'Error grouping users' });
  } finally {
    conn.release();
  }
});

//User leave peer group...
router.delete('/', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.execute(`
      DELETE FROM peer_groups
    `);

    await conn.commit();
    res.status(201).json({ message: 'All Groups was deleted successfully'});

  } catch (err) {
    await conn.rollback();
    console.error('Error deleting user group:', err);
    res.status(500).json({ message: 'Error deleting group', err });
  } finally {
    conn.release();
  }
});

//Admin remove user from peer group...
router.delete('/:groupId', async (req, res) => {
    const { groupId } = req.params
  const conn = await pool.getConnection();

    if (!groupId) {
      return res.status(200).json({ message: 'Peer group id is required...' });
    }

  try {

    await conn.execute(`
      DELETE FROM peer_groups WHERE id= ?
    `, [groupId]);

    await conn.commit();
    res.status(201).json({ message: 'Group was deleted successfully'});

  } catch (err) {
    await conn.rollback();
    console.error('Error deleting user group:', err);
    res.status(500).json({ message: 'Error deleting group', err });
  } finally {
    conn.release();
  }
});

module.exports = router;

