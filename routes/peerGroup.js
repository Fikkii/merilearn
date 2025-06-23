const express = require('express');
const router = express.Router();
const pool = require('../db');

const { getTemplate } = require('../utils/emailTemplates');

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

const techNouns = [ 'Protocol', 'Script', 'Pixel', 'Matrix', 'Circuit', 'Stack', 'Cluster', 'Kernel', 'Cipher', 'Byte', 'Cache', 'Runtime', 'Compiler', 'Bot', 'Daemon', 'Module', 'Package', 'Patch', 'Protocol', 'Query', 'Algorithm', 'Repository', 'Interface', 'Network', 'Pipeline', 'Firmware', 'Browser', 'Server', 'Console', 'Firewall', 'Socket', 'Blockchain', 'App', 'Cloud', 'Terminal', 'Buffer', 'Registry', 'Session', 'Thread', 'Webhook', 'Framework', 'Model', 'Grid', 'Node', 'Core', 'Interface', 'Engine', 'Cluster', 'Gateway', 'Microservice', 'Workspace', 'Hyperlink', 'Switch', 'Bridge', 'Router', 'Forge', 'Studio', 'Sandbox', 'Lab', 'Hub', 'Deck', 'Beacon', 'Vault', 'Hive', 'Codebase'
]

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

// Automatically Assign Group Across All Courses
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  const groupsize = 4;

  try {
    // Step 1: Get all ungrouped students with course info
    const [ungroupedStudents] = await conn.execute(`
      SELECT u.id, p.fullname, u.email, e.course_id
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN student_profiles p ON u.id = p.id
      JOIN enrollments e ON u.id = e.student_id
      WHERE r.role = 'student'
        AND u.id NOT IN (
          SELECT user_id FROM peer_group_members
        )
    `);

    if (ungroupedStudents.length < groupsize) {
      return res.status(200).json({ message: 'Not enough ungrouped students to form a group.' });
    }

    // Step 2: Group students by course_id
    const studentsByCourse = ungroupedStudents.reduce((acc, student) => {
      if (!acc[student.course_id]) acc[student.course_id] = []
      acc[student.course_id].push(student)
      return acc
    }, {})

    const createdGroups = []
    await conn.beginTransaction();

    // Step 3: For each course, shuffle and form groups
    for (const courseId in studentsByCourse) {
      const students = studentsByCourse[courseId]

      // Shuffle using Fisher–Yates
      for (let i = students.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[students[i], students[j]] = [students[j], students[i]]
      }

      // Chunk students into groups
      const chunks = chunkArray(students, groupsize)

      for (const groupUsers of chunks) {
        if (groupUsers.length < groupsize) continue;

        const leaderId = groupUsers[0].id
        const groupName = uniqueNamesGenerator({
          dictionaries: [techAdjectives, techNouns],
          separator: '-',
          style: 'capital',
        })

        const [groupResult] = await conn.execute(
          `INSERT INTO peer_groups (name, leader_id, course_id) VALUES (?, ?, ?)`,
          [groupName, leaderId, courseId]
        )

        const groupId = groupResult.insertId

        for (const student of groupUsers) {

            //Make sure peer group has been formed before sending mails to user
          await conn.execute(
            `INSERT INTO peer_group_members (user_id, group_id) VALUES (?, ?)`,
            [student.id, groupId]
          )

            // Send Email to Users...
            const template = getTemplate('peer-group-allocation');
            const html = template.replace('{{userName}}', student.email);

            req.mailer.sendMail({
                from: `"MerilLearn" <${process.env.SMTP_USER}>`,
              to: user.email,
              subject: 'You have been assigned to a peer group',
              html,
            }).catch(err => {
              console.error('Mailer error:', err);
            });
        }

        createdGroups.push({ id: groupId, name: groupName, course_id: courseId })
      }
    }

    await conn.commit()
    res.status(201).json({ message: 'Groups formed for all courses', groups: createdGroups })

  } catch (err) {
    await conn.rollback()
    console.error('Error grouping students across courses:', err)
    res.status(500).json({ message: 'Error grouping students across courses' })
  } finally {
    conn.release()
  }
})

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

