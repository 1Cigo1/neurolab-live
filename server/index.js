const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

const io = new Server(PORT, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log(`🚀 Sunucu ${PORT} portunda BAŞLADI!`);

io.on("connection", (socket) => {
    
    // Odaya girerken odayı String'e çevirip garantiliyoruz
    socket.on("join_room", (room) => {
        const roomID = String(room).trim(); // Boşlukları sil, metne çevir
        socket.join(roomID);
        
        console.log(`✅ [GİRİŞ] ${socket.id} -> Oda: "${roomID}"`);
        
        // Odaya girene "Hoşgeldin" de
        socket.emit("welcome", { text: `Odaya (${roomID}) bağlandın.` });

        // Odadaki HERKESE (Giren dahil) haber ver
        io.in(roomID).emit("user_joined_alert", { userId: socket.id });
        
        // Herkesten skorlarını iste
        io.in(roomID).emit("request_data_refresh");
    });

    // MESAJ (HERKESE)
    socket.on("send_message", (data) => {
        const roomID = String(data.room).trim();
        console.log(`💬 [MESAJ] "${data.text}" -> Oda: "${roomID}"`);
        
        // Mesajı herkese (gönderen dahil) geri yolla
        io.in(roomID).emit("receive_message", {
            userId: socket.id,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    // SKOR (HERKESE)
    socket.on("broadcast_loss", (data) => {
        const roomID = String(data.room).trim();
        io.in(roomID).emit("update_leaderboard", { 
            userId: data.userId, 
            loss: data.loss 
        });
    });

    // Diğer senkronizasyonlar
    socket.on("sync_architecture", (d) => socket.to(String(d.room).trim()).emit("sync_architecture", d.architecture));
    socket.on("sync_dead_neurons", (d) => socket.to(String(d.room).trim()).emit("sync_dead_neurons", d.deadNeurons));
    socket.on("sync_training_start", (room) => socket.to(String(room).trim()).emit("sync_training_start"));
    socket.on("cursor_move", (d) => socket.to(String(d.room).trim()).emit("remote_cursor_move", { userId: socket.id, position: d.position }));

    socket.on("disconnecting", () => {
        [...socket.rooms].forEach(room => io.in(room).emit("user_left", { userId: socket.id }));
    });
});

io.listen(PORT);