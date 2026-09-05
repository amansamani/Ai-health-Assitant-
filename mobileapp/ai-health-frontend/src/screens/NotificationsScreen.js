import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import LucideIcon from "../components/ui/LucideIcon";
import API from "../services/api";
import { COLORS } from "../constants/theme";

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (nextPage = 1) => {
    nextPage === 1 ? setLoading(true) : setLoadingMore(true);
    try {
      const res = await API.get("/notifications", { params: { page: nextPage, limit: 20 } });
      setItems((prev) => nextPage === 1 ? (res.data?.items || []) : [...prev, ...(res.data?.items || [])]);
      setPage(nextPage); setHasMore(Boolean(res.data?.hasMore));
    } catch (_) {} finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  const open = async (item) => {
    setItems((prev) => prev.map((x) => x._id === item._id ? { ...x, readAt: x.readAt || new Date().toISOString() } : x));
    if (!item.readAt) API.post(`/notifications/${item._id}/read`).catch(() => {});
    const type = item.type;
    if (type === "followRequest") router.push("/(app)/social/follow-requests");
    else if (["newFollower", "followAccepted"].includes(type) && item.data?.userId) router.push({ pathname: "/(app)/social/profile", params: { identifier: item.data.userId } });
    else if (type === "runLike") router.push("/(app)/run-feed");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}><Pressable style={styles.back} onPress={() => router.back()}><LucideIcon name="chevron-back" size={22} color={COLORS.textDark} /></Pressable><Text style={styles.title}>Notifications</Text><Pressable onPress={() => API.post("/notifications/read-all").then(() => setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })))).catch(() => {})}><Text style={styles.readAll}>Read all</Text></Pressable></View>
      {loading ? <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} /> : <FlatList data={items} keyExtractor={(item) => String(item._id)} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} renderItem={({ item }) => (
        <Pressable onPress={() => open(item)} style={[styles.row, !item.readAt && styles.unread]}>
          <View style={styles.icon}><LucideIcon name={item.type === "runLike" ? "heart" : item.type === "followRequest" ? "person-add-outline" : "notifications-outline"} size={20} color={COLORS.primary} /></View>
          <View style={{ flex: 1 }}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemBody}>{item.body}</Text><Text style={styles.time}>{new Date(item.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text></View>
          {!item.readAt && <View style={styles.unreadDot} />}
        </Pressable>
      )} onEndReached={() => { if (hasMore && !loadingMore) load(page + 1); }} onEndReachedThreshold={0.5} ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 18 }} /> : null} ListEmptyComponent={<Text style={styles.empty}>You're all caught up.</Text>} /> }
    </SafeAreaView>
  );
}
const styles=StyleSheet.create({ container:{flex:1,backgroundColor:COLORS.background}, header:{flexDirection:"row",alignItems:"center",padding:16,gap:12},back:{width:40,height:40,borderRadius:12,backgroundColor:COLORS.surface,borderWidth:1,borderColor:COLORS.border,alignItems:"center",justifyContent:"center"},title:{flex:1,color:COLORS.textDark,fontSize:24,fontWeight:"900"},readAll:{color:COLORS.primary,fontSize:12,fontWeight:"800"},row:{flexDirection:"row",alignItems:"center",gap:12,backgroundColor:COLORS.surface,borderRadius:18,borderWidth:1,borderColor:COLORS.border,padding:14,marginBottom:9},unread:{borderColor:COLORS.primaryLight,backgroundColor:COLORS.surfaceMuted},icon:{width:42,height:42,borderRadius:14,backgroundColor:COLORS.primary+"16",alignItems:"center",justifyContent:"center"},itemTitle:{color:COLORS.textDark,fontSize:14,fontWeight:"850"},itemBody:{color:COLORS.textMuted,fontSize:12,lineHeight:17,marginTop:3},time:{color:COLORS.textLight,fontSize:10,marginTop:5},unreadDot:{width:8,height:8,borderRadius:4,backgroundColor:COLORS.primary},empty:{textAlign:"center",color:COLORS.textMuted,padding:40,fontWeight:"600"} });
