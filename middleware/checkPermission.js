const { ForbiddenError } = require('@casl/ability');

function checkPermission(action, subject) {
  return (req, res, next) => {
    const ability = req.ability;
    try {
      ForbiddenError.from(ability).throwUnlessCan(action, subject);
      next();
    } catch (err) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
  };
}

module.exports = { checkPermission }
