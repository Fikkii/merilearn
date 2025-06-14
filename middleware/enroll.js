const pool = require('../db')

const checkEnrollment = async (req, res, next) => {
  try {
    // Get the student's enrolled course
    const [enrollments] = await pool.query(`
      SELECT course_id FROM enrollments WHERE student_id = ?
    `, [req.user.id]);

    // Check if any rows were returned
    if (enrollments.length === 0) {
      return res.status(404).json({ error: 'No enrolled course found for the student.' });
    }

    req.user.course_id = enrollments[0].course_id;
    next();
  } catch (err) {
    console.error('Error checking enrollment for student:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = checkEnrollment;

