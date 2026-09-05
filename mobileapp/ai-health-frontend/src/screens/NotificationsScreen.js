import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import LucideIcon from "../components/ui/LucideIcon";
import API from "../services/api";
import { COLORS } from "../constants/theme";

const titleFor = (moment) => ({
  newFollower: "New follower", followAccepted: "Follow request accepted", followRequest: "Follow request",
  achievementEarned: "Achievement unlocked", duelChallenged: "New duel", duelAccepted: "Duel accepted",
  duelWon: "Duel won", duelLost: "Duel result", duelTie: "Duel tied", weeklyInsight: "Weekly insight",
})[moment] || "FitLip update";

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/notifications").catch(() => ({ data: { items: [] } }));
      setItems(Array.isArray(data) ? data : (data?.items || []));
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}><LucideIcon name="chevron-back" size={21} color={COLORS.textDark} /></Pressable>
        <View><Text style={styles.title}>Notifications</Text><Text style={styles.sub}>Your FitLip activity</Text></View>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View> : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => String(item._id || item.id || index)}
          contentContainerStyle={[styles.list, !items.length && styles.emptyList]}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.iconWrap}><LucideIcon name={String(item.moment || "").includes("follow") ? "person-add-outline" : String(item.moment || "").includes("duel") ? "flash-outline" : "notifications-outline"} size={19} color={COLORS.primary} /></View>
              <View style={styles.copy}><Text style={styles.cardTitle}>{item.title || titleFor(item.moment)}</Text><Text style={styles.cardBody}>{item.body || item.message || "You have a new FitLip update."}</Text>{item.createdAt ? <Text style={styles.time}>{new Date(item.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text> : null}</View>
            </View>
          )}
          ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><LucideIcon name="notifications-off-outline" size={28} color={COLORS.primary} /></View><Text style={styles.emptyTitle}>You&apos;re all caught up</Text><Text style={styles.emptyBody}>New follows, likes, requests and achievements will appear here.</Text></View>}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({container:{flex:1,backgroundColor:COLORS.background},header:{minHeight:76,paddingHorizontal:16,flexDirection:"row",alignItems:"center",gap:12},iconBtn:{width:42,height:42,borderRadius:13,backgroundColor:COLORS.surface,borderWidth:1,borderColor:COLORS.border,alignItems:"center",justifyContent:"center"},title:{fontSize:21,fontWeight:"900",color:COLORS.textDark},sub:{fontSize:11.5,color:COLORS.textMuted,marginTop:2,fontWeight:"600"},list:{padding:16,paddingTop:4,paddingBottom:32},emptyList:{flexGrow:1,justifyContent:"center"},card:{flexDirection:"row",gap:12,backgroundColor:COLORS.surface,borderWidth:1,borderColor:COLORS.border,borderRadius:18,padding:14,marginBottom:10},iconWrap:{width:42,height:42,borderRadius:14,backgroundColor:COLORS.primary+"14",alignItems:"center",justifyContent:"center"},copy:{flex:1},cardTitle:{fontSize:14,fontWeight:"800",color:COLORS.textDark},cardBody:{marginTop:4,fontSize:12,lineHeight:17,color:COLORS.textMuted},time:{marginTop:6,fontSize:10.5,color:COLORS.textLight,fontWeight:"600"},center:{flex:1,alignItems:"center",justifyContent:"center"},empty:{padding:28,borderRadius:22,borderWidth:1,borderColor:COLORS.border,backgroundColor:COLORS.surface,alignItems:"center"},emptyIcon:{width:60,height:60,borderRadius:20,backgroundColor:COLORS.surfaceMuted,alignItems:"center",justifyContent:"center",marginBottom:12},emptyTitle:{fontSize:17,fontWeight:"800",color:COLORS.textDark},emptyBody:{marginTop:6,textAlign:"center",maxWidth:290,fontSize:12.5,lineHeight:18,color:COLORS.textMuted}});
