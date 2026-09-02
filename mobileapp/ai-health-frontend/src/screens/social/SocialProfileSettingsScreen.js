import { useCallback, useEffect, useState } from "react";
import { showToast } from "../../services/uiFeedback";
import { Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { API_BASE_URL } from "../../services/api";
import { getToken } from "../../utils/secureToken";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import LucideIcon from "../../components/ui/LucideIcon";
import API from "../../services/api";
import { COLORS, SHADOW } from "../../constants/theme";

export default function SocialProfileSettingsScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [token, setToken] = useState(null);
  const [photoSaving, setPhotoSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/user/profile");
      setUsername(data.username || "");
      setBio(data.bio || "");
      setVisibility(data.profileVisibility || "private");
      setProfilePhoto(data);
      setToken(await getToken());
    } catch (err) {
      showToast(err.response?.data?.message || "Please try again.", { title: "Couldn't load social profile", type: "error" });
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const choosePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast("Allow photo access in Settings to choose a profile picture.", { title: "Photo access needed", type: "warning" });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setPhotoSaving(true);
      const prepared = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 720, height: 720 } }], { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      await API.put("/user/profile/photo", { imageBase64: prepared.base64, contentType: "image/jpeg" });
      const fresh = await API.get("/user/profile");
      setProfilePhoto(fresh.data);
      setToken(await getToken());
    } catch (err) {
      showToast(err.response?.data?.message || "Please try another image.", { title: "Couldn't update photo", type: "error" });
    } finally { setPhotoSaving(false); }
  };

  const save = async () => {
    try {
      setSaving(true);
      await API.put("/user/profile", { username, bio, profileVisibility: visibility });
      showToast("Your social identity has been updated.", { title: "Saved", type: "success" });
      router.back();
    } catch (err) {
      showToast(err.response?.data?.message || "Please try again.", { title: "Couldn't save", type: "error" });
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}><LucideIcon name="chevron-back" size={22} color={COLORS.textDark} /></Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.title}>Social Identity</Text><Text style={styles.subtitle}>Separate from health and workout settings</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.photoCard}>
          <View style={styles.photoWrap}>
            {profilePhoto?.hasProfilePhoto && profilePhoto?._id && token ? (
              <Image source={{ uri: `${API_BASE_URL}/user/profile/photo/${profilePhoto._id}?v=${encodeURIComponent(profilePhoto.profileImageUpdatedAt || "1")}`, headers: { Authorization: `Bearer ${token}` } }} style={styles.photo} />
            ) : (
              <View style={styles.photoFallback}><LucideIcon name="person" size={30} color={COLORS.textMuted} /></View>
            )}
          </View>
          <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Profile photo</Text><Text style={styles.cardSub}>Change the photo shown across your FitLip profile.</Text></View>
          <Pressable style={styles.photoBtn} onPress={choosePhoto} disabled={photoSaving}>{photoSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.photoBtnText}>Change</Text>}</Pressable>
        </View>
        <View style={styles.identityCard}><View style={styles.identityIcon}><LucideIcon name="people-outline" size={22} color={COLORS.primary} /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Your social profile</Text><Text style={styles.cardSub}>Username, bio and visibility control your public FitLip identity.</Text></View></View>
        <Text style={styles.label}>USERNAME</Text>
        <View style={styles.inputWrap}><Text style={styles.prefix}>@</Text><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={30} style={styles.input} placeholder="your_username" placeholderTextColor={COLORS.textMuted} /></View>
        <Text style={styles.label}>BIO</Text>
        <TextInput value={bio} onChangeText={setBio} maxLength={160} multiline style={styles.bio} placeholder="Train. Eat. Repeat." placeholderTextColor={COLORS.textMuted} />
        <Text style={styles.label}>PROFILE VISIBILITY</Text>
        <View style={styles.visibilityRow}>
          {[{key:"public",icon:"globe-outline",title:"Public",sub:"Anyone can find you"},{key:"private",icon:"lock-closed-outline",title:"Private",sub:"Approve follow requests"}].map((opt) => (
            <Pressable key={opt.key} onPress={() => setVisibility(opt.key)} style={[styles.visibilityCard, visibility === opt.key && styles.visibilitySelected]}>
              <LucideIcon name={opt.icon} size={20} color={visibility === opt.key ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.visibilityTitle, visibility === opt.key && {color:COLORS.primary}]}>{opt.title}</Text>
              <Text style={styles.visibilitySub}>{opt.sub}</Text>
              {visibility === opt.key && <LucideIcon name="checkmark-circle" size={16} color={COLORS.primary} style={styles.check} />}
            </Pressable>
          ))}
        </View>
        <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, saving && {opacity:0.65}]}>{saving ? <ActivityIndicator color="#fff" /> : <><LucideIcon name="save-outline" size={18} color="#fff" /><Text style={styles.saveText}>Save Social Profile</Text></>}</Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({
 container:{flex:1,backgroundColor:COLORS.background},photoCard:{flexDirection:"row",alignItems:"center",backgroundColor:COLORS.surface,borderRadius:20,borderWidth:1,borderColor:COLORS.border,padding:14,marginBottom:12},photoWrap:{width:58,height:58,borderRadius:29,marginRight:12,overflow:"hidden",backgroundColor:COLORS.surfaceMuted},photo:{width:58,height:58,borderRadius:29},photoFallback:{width:58,height:58,borderRadius:29,alignItems:"center",justifyContent:"center"},photoBtn:{minHeight:36,paddingHorizontal:12,borderRadius:11,backgroundColor:COLORS.primary,alignItems:"center",justifyContent:"center"},photoBtnText:{color:"#fff",fontSize:11.5,fontWeight: "800"},center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:COLORS.background},header:{flexDirection:"row",alignItems:"center",padding:16,borderBottomWidth:1,borderBottomColor:COLORS.border,backgroundColor:COLORS.surface},back:{width:40,height:40,borderRadius: 12,backgroundColor:COLORS.surfaceMuted,alignItems:"center",justifyContent:"center"},title:{fontSize:20,fontWeight: "800",color:COLORS.textDark},subtitle:{marginTop:2,fontSize:11.5,color:COLORS.textMuted,fontWeight:"600"},scroll:{padding:20,paddingBottom:44},identityCard:{flexDirection:"row",alignItems:"center",backgroundColor:COLORS.surface,borderRadius:20,borderWidth:1,borderColor:COLORS.border,padding:16,marginBottom:18,...SHADOW},identityIcon:{width:46,height:46,borderRadius:15,backgroundColor:COLORS.surfaceMuted,alignItems:"center",justifyContent:"center",marginRight:12},cardTitle:{fontSize:15,fontWeight: "800",color:COLORS.textDark},cardSub:{marginTop:4,fontSize:11.5,lineHeight:16,color:COLORS.textMuted,fontWeight:"600"},label:{marginTop:14,marginBottom:7,fontSize:10,fontWeight: "800",letterSpacing:.9,color:COLORS.textMuted},inputWrap:{flexDirection:"row",alignItems:"center",backgroundColor:COLORS.surface,borderRadius:15,borderWidth:1,borderColor:COLORS.border,paddingHorizontal:12},prefix:{fontSize:16,fontWeight: "800",color:COLORS.primary},input:{flex:1,paddingHorizontal:6,paddingVertical:14,color:COLORS.textDark,fontSize:15,fontWeight:"700"},bio:{minHeight:100,textAlignVertical:"top",backgroundColor:COLORS.surface,borderRadius:15,borderWidth:1,borderColor:COLORS.border,padding:14,color:COLORS.textDark,fontSize:14,lineHeight:20},visibilityRow:{flexDirection:"row",gap:10},visibilityCard:{flex:1,minHeight:112,borderRadius:17,backgroundColor:COLORS.surface,borderWidth:1.5,borderColor:COLORS.border,padding:14,position:"relative"},visibilitySelected:{borderColor:COLORS.primary,backgroundColor:COLORS.primary+"10"},visibilityTitle:{marginTop:10,fontSize:14,fontWeight: "800",color:COLORS.textDark},visibilitySub:{marginTop:4,fontSize:10.5,lineHeight:15,color:COLORS.textMuted,fontWeight:"600"},check:{position:"absolute",top:10,right:10},saveBtn:{marginTop:24,minHeight:52,borderRadius:16,backgroundColor:COLORS.primary,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,...SHADOW},saveText:{color:"#fff",fontSize:14,fontWeight: "800"}
});
