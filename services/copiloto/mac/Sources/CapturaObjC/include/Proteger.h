#import <Foundation/Foundation.h>

/// AVFAudio lanza NSException, que Swift no puede atrapar: pasa de largo por sus marcos y deja la app
/// rota. Así se cayó Gumdramon en plena reunión de Teams. Aquí se convierte en un error normal.
@interface Proteger : NSObject
+ (BOOL)ejecutar:(NS_NOESCAPE void (^)(void))bloque error:(NSError **)error;
@end
