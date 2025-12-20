const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

const io = new Server(PORT, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log(`🚀 Sunucu ${PORT} portunda HAZIR!`);

io.on("connection", (socket) => {
    
    socket.on("join_room", (room) => {
        socket.join(room);
        console.log(`✅ ${socket.id} odaya girdi: ${room}`);
        
        // 1. Odaya biri girdi, herkes duysun
        io.in(room).emit("user_joined_alert", { userId: socket.id });
        
        // 2. Herkes elindeki skoru masaya koysun
        io.in(room).emit("request_data_refresh");
    });

    // --- SKOR YAYINI (HERKESE) ---
    socket.on("broadcast_loss", (data) => {
        // Gelen veriyi olduğu gibi herkese dağıt
        io.in(data.room).emit("update_leaderboard", { 
            userId: data.userId, 
            loss: data.loss 
        });
    });

    // --- SOHBET (HERKESE) ---
    socket.on("send_message", (data) => {
        // Mesajı herkese dağıt
        io.in(data.room).emit("receive_message", {
            userId: socket.id,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    // --- DİĞERLERİ ---
    socket.on("cursor_move", (d) => socket.to(d.room).emit("remote_cursor_move", { userId: socket.id, position: d.position }));
    socket.on("sync_architecture", (d) => socket.to(d.room).emit("sync_architecture", d.architecture));
    socket.on("sync_dead_neurons", (d) => socket.to(d.room).emit("sync_dead_neurons", d.deadNeurons));
    socket.on("sync_training_start", (room) => socket.to(room).emit("sync_training_start"));

    socket.on("disconnecting", () => {
        [...socket.rooms].forEach(room => io.in(room).emit("user_left", { userId: socket.id }));
    });
});

io.listen(PORT);