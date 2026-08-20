/**
 * WebSocket event handlers for real-time dashboard updates
 */
module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Dashboard connected: ${socket.id}`);

    socket.on('subscribe:ticket', (ticketId) => {
      socket.join(`ticket:${ticketId}`);
      console.log(`   Subscribed to ticket: ${ticketId}`);
    });

    socket.on('unsubscribe:ticket', (ticketId) => {
      socket.leave(`ticket:${ticketId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Dashboard disconnected: ${socket.id}`);
    });
  });
};
