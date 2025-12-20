const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

const io = new Server(PORT, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log(`🚀 Sunucu ${PORT} portunda aktif!`);

io.on("connection", (socket) => {
    socket.on("join_room", (room) => {
        socket.join(room);
        
        // Giren kişiye odadaki diğerlerinin skorlarını iste
        socket.to(room).emit("request_leaderboard_update");
        
        // Odadakilere yeni birinin geldiğini söyle
        io.in(room).emit("user_joined_alert", { userId: socket.id });
    });

    // SKOR YAYINI (Fix)
    socket.on("broadcast_loss", (data) => {
        // Herkese yolla
        io.in(data.room).emit("update_leaderboard", { userId: data.userId, loss: data.loss });
    });

    // SOHBET (Fix)
    socket.on("send_message", (data) => {
        io.in(data.room).emit("receive_message", {
            userId: socket.id,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    // DİĞERLERİ
    socket.on("cursor_move", (d) => socket.to(d.room).emit("remote_cursor_move", { userId: socket.id, position: d.position }));
    socket.on("sync_architecture", (d) => socket.to(d.room).emit("sync_architecture", d.architecture));
    socket.on("sync_dead_neurons", (d) => socket.to(d.room).emit("sync_dead_neurons", d.deadNeurons));
    socket.on("sync_training_start", (room) => socket.to(room).emit("sync_training_start"));
    
    socket.on("disconnecting", () => {
        [...socket.rooms].forEach(room => io.in(room).emit("user_left", { userId: socket.id }));
    });
});

io.listen(PORT);