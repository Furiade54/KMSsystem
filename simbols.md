
Claro. Si te refieres a los **códigos ASCII de los símbolos especiales** que estamos usando en los comandos y en el archivo YAML, aquí tienes una tabla práctica.

 ### Símbolos usados en Netplan / Linux

 | Símbolo | Nombre | ASCII decimal | ASCII hexadecimal | Uso |
| --- | --- | --- | --- | --- |
| `:` | Dos puntos | **58** | `0x3A` | `via:` `addresses:` |
| `-` | Guion | **45** | `0x2D` | Listas YAML: `- to:` |
| `/` | Barra / slash | **47** | `0x2F` | `253/29` |
| `.` | Punto | **46** | `0x2E` | IP: `98.xxx.xxx.253` |
| `_` | Guion bajo | **95** | `0x5F` | `00-installer-config.yaml` |
| `#` | Almohadilla / hash | **35** | `0x23` | Comentarios YAML |
| `'` | Comilla simple | **39** | `0x27` | Comandos `sed` |
| `"` | Comilla doble | **34** | `0x22` | Cadenas de texto |
| `=` | Igual | **61** | `0x3D` | Opciones/parámetros |
| `[` | Corchete izquierdo | **91** | `0x5B` | Expresiones de `sed` |
| `]` | Corchete derecho | **93** | `0x5D` | Expresiones de `sed` |
| `*` | Asterisco | **42** | `0x2A` | Comodín: `*.yaml` |
| `\` | Barra inversa / backslash | **92** | `0x5C` | Escapes en `sed` |
| `$` | Dólar | **36** | `0x24` | Variables / expresiones |
| `>` | Mayor que | **62** | `0x3E` | Redirección de salida |
| `<` | Menor que | **60** | `0x3C` | Redirección de entrada |
| \` | \` | Pipe / tubería | **124** | `0x7C` |
| `;` | Punto y coma | **59** | `0x3B` | Separar comandos |
| `' '` | Espacio | **32** | `0x20` | Separación entre elementos |
| `Tab` | Tabulación | **9** | `0x09` | Indentación, aunque mejor evitarla en YAML |

### Los más importantes para **este problema**

 Especialmente fíjate en estos:

 | Símbolo | ASCII | Ejemplo correcto |
| --- | --- | --- |
| `:` | **58** | `via: 98.xxx.xxx.249` |
| `-` | **45** | `- to: default` |
| espacio | **32** | `via:` \+ **espacio** \+ `98...` |
| `.` | **46** | `98.xxx.xxx.253` |
| `/` | **47** | `253/29` |

Por ejemplo, esta línea:

```
                  via: 98.xxx.xxx.249
```

 contiene:

```
via
:
ESPACIO
98
.
xxx
.
xxx
.
249
```

 El detalle que nos estaba dando el error era que tenía algo equivalente a:

```
via:98.xxx.xxx.249
```

 en lugar de:

```
via: 98.xxx.xxx.249
```

 Es decir, **después del ASCII `:` (58) necesitamos un espacio ASCII `32`**.