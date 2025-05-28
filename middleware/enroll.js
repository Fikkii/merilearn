const db = require('../db')
const checkEnrollment = (req, res, next) => {
    try {
    // Get the student's enrolled course
    const enrollment = db.prepare(`
      SELECT course_id FROM enrollments WHERE student_id = ?
    `).get(req.user.id);
        if (!enrollment) {
            return res.status(404).json({ error: 'No enrolled course found for the student.' });
        }

        req.user.course_id = enrollment.course_id
        next();
    } catch (err) {
        console.error('Error checking Enrollment for student:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = checkEnrollment;

