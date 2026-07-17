const app = require('./app');
const smsWorker = require('./services/smsWorker');
const smsGateway = require('./services/smsGateway');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  smsWorker.start();
  smsGateway.subscribeOrangeDeliveryReceipts();
});
