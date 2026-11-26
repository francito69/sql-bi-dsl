const { app } = require('./app');
const { startAlertScheduler } = require('./alertEngine');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`.SQL-BI escuchando en http://localhost:${PORT}`);
  startAlertScheduler();
});
