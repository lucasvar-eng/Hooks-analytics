const express = require('express');
const router = express.Router();
const teamNoteController = require('../controllers/teamNoteController');
const { auth } = require('../middleware/auth');

router.get('/stores/:id/notes', auth, teamNoteController.list);
router.post('/stores/:id/notes', auth, teamNoteController.create);
router.delete('/stores/:id/notes/:noteId', auth, teamNoteController.remove);

module.exports = router;
