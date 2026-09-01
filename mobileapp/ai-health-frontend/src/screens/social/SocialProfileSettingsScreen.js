import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import API from "../../services/api";
import { COLORS, SHADOW } from "../../constants/theme";

export default function SocialProfileSettingsScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/user/profile");
      setUsername(data.username || "");
      setBio(data.bio || "");
      setVisibility(data.profileVisibility || "private");
    } catch (err) {
      Alert.alert("Couldn't load social profile", err.response?.data?.message || "Please try again.");
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    try {
      setSaving(true);
      await API.put("/user/profile", { username, bio, profileVisibility: visibility });
      Alert.alert("Saved", "Your social identity has been updated.");
      router.back();
    } catch (err) {
      Alert.alert("Couldn't save", err.response?.data?.message || "Please try again.");
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={22} color={COLORS.textDark} /></Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.title}>Social Identity</Text><Text style={styles.subtitle}>Separate from health and workout settings</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.identityCard}><View style={styles.identityIcon}><Ionicons name="people-outline" size={22} color={COLORS.primary} /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Your social profile</Text><Text style={styles.cardSub}>Username, bio and visibility control your public FitLip identity.</Text></View></View>
        <Text style={styles.label}>USERNAME</Text>
        <View style={styles.inputWrap}><Text style={styles.prefix}>@</Text><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={30} style={styles.input} placeholder="your_username" placeholderTextColor={COLORS.textMuted} /></View>
        <Text style={styles.label}>BIO</Text>
        <TextInput value={bio} onChangeText={setBio} maxLength={160} multiline style={styles.bio} placeholder="Train. Eat. Repeat." placeholderTextColor={COLORS.textMuted} />
        <Text style={styles.label}>PROFILE VISIBILITY</Text>
        <View style={styles.visibilityRow}>
          {[{key:"public",icon:"globe-outline",title:"Public",sub:"Anyone can find you"},{key:"private",icon:"lock-closed-outline",title:"Private",sub:"Approve follow requests"}].map((opt) => (
            <Pressable key={opt.key} onPress={() => setVisibility(opt.key)} style={[styles.visibilityCard, visibility === opt.key && styles.visibilitySelected]}>
              <Ionicons name={opt.icon} size={20} color={visibility === opt.key ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.visibilityTitle, visibility === opt.key && {color:COLORS.primary}]}>{opt.title}</Text>
              <Text style={styles.visibilitySub}>{opt.sub}</Text>
              {visibility === opt.key && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} style={styles.check} />}
            </Pressable>
          ))}
        </View>
        <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, saving && {opacity:0.65}]}>{saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="save-outline" size={18} color="#fff" /><Text style={styles.saveText}>Save Social Profile</Text></>}</Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({
 container:{flex:1,backgroundColor:COLORS.background},center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:COLORS.background},header:{flexDirection:"row",alignItems:"center",padding:16,borderBottomWidth:1,borderBottomColor:COLORS.border,backgroundColor:COLORS.surface},back:{width:40,height:40,borderRadius:14,backgroundColor:COLORS.surfaceMuted,alignItems:"center",justifyContent:"center"},title:{fontSize:20,fontWeight:"900",color:COLORS.textDark},subtitle:{marginTop:2,fontSize:11.5,color:COLORS.textMuted,fontWeight:"600"},scroll:{padding:20,paddingBottom:44},identityCard:{flexDirection:"row",alignItems:"center",backgroundColor:COLORS.surface,borderRadius:20,borderWidth:1,borderColor:COLORS.border,padding:16,marginBottom:18,...SHADOW},identityIcon:{width:46,height:46,borderRadius:15,backgroundColor:COLORS.surfaceMuted,alignItems:"center",justifyContent:"center",marginRight:12},cardTitle:{fontSize:15,fontWeight:"900",color:COLORS.textDark},cardSub:{marginTop:4,fontSize:11.5,lineHeight:16,color:COLORS.textMuted,fontWeight:"600"},label:{marginTop:14,marginBottom:7,fontSize:10,fontWeight:"900",letterSpacing:.9,color:COLORS.textMuted},inputWrap:{flexDirection:"row",alignItems:"center",backgroundColor:COLORS.surface,borderRadius:15,borderWidth:1,borderColor:COLORS.border,paddingHorizontal:12},prefix:{fontSize:16,fontWeight:"900",color:COLORS.primary},input:{flex:1,paddingHorizontal:6,paddingVertical:14,color:COLORS.textDark,fontSize:15,fontWeight:"700"},bio:{minHeight:100,textAlignVertical:"top",backgroundColor:COLORS.surface,borderRadius:15,borderWidth:1,borderColor:COLORS.border,padding:14,color:COLORS.textDark,fontSize:14,lineHeight:20},visibilityRow:{flexDirection:"row",gap:10},visibilityCard:{flex:1,minHeight:112,borderRadius:17,backgroundColor:COLORS.surface,borderWidth:1.5,borderColor:COLORS.border,padding:14,position:"relative"},visibilitySelected:{borderColor:COLORS.primary,backgroundColor:COLORS.primary+"10"},visibilityTitle:{marginTop:10,fontSize:14,fontWeight:"900",color:COLORS.textDark},visibilitySub:{marginTop:4,fontSize:10.5,lineHeight:15,color:COLORS.textMuted,fontWeight:"600"},check:{position:"absolute",top:10,right:10},saveBtn:{marginTop:24,minHeight:52,borderRadius:16,backgroundColor:COLORS.primary,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,...SHADOW},saveText:{color:"#fff",fontSize:14,fontWeight:"900"}
});
