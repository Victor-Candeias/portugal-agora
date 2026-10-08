# Gson desserializa os modelos das APIs por reflexão (sem @SerializedName):
# manter nomes de campos e construtores para o R8 não os renomear/remover.
-keepattributes Signature, *Annotation*, InnerClasses, EnclosingMethod
-keep class pt.portugalhoje.auto.api.** { <fields>; <init>(...); }
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken
-dontwarn com.google.gson.**
