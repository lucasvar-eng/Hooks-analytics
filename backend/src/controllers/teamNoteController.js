const TeamNote = require('../models/TeamNote');

// GET /stores/:id/notes?section=
exports.list = async (req, res, next) => {
  try {
    const filter = { storeId: req.params.id };
    if (req.query.section) filter.section = req.query.section;

    const notes = await TeamNote.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('author', 'nombre')
      .lean();

    res.json(notes);
  } catch (error) {
    next(error);
  }
};

// POST /stores/:id/notes
exports.create = async (req, res, next) => {
  try {
    const { section, text } = req.body;

    if (!text) return res.status(400).json({ error: 'text is required' });

    const note = await TeamNote.create({
      storeId: req.params.id,
      section: section || 'general',
      text,
      author: req.user._id,
    });

    const populated = await note.populate('author', 'nombre');

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

// DELETE /stores/:id/notes/:noteId
exports.remove = async (req, res, next) => {
  try {
    const note = await TeamNote.findOneAndDelete({
      _id: req.params.noteId,
      storeId: req.params.id,
    });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};
